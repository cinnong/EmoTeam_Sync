from flask import Flask, request, redirect, url_for, render_template, flash, session, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Team, TeamMember, Session, EmotionData, Notification
import random
import string

import os

app = Flask(__name__)
CORS(app, 
     resources={r"/api/*": {"origins": os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')}}, 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:@localhost/emoteam2')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.environ.get('SECRET_KEY', 'supersecretkey')
db.init_app(app)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        nama = request.form['nama']
        email = request.form['email']
        password = generate_password_hash(request.form['password'])

        new_user = User(nama=nama, email=email, password=password)
        db.session.add(new_user)
        db.session.commit()
        flash('Registrasi berhasil!', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            session['user_id'] = user.id
            flash('Login berhasil!', 'success')
            return redirect(url_for('profile'))
        else:
            flash('Email atau password salah!', 'danger')

    return render_template('login.html')

@app.route('/')
def home():
    return 'Selamat datang di Emo Team!'

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register():
    if request.method == 'OPTIONS':
        # Handle preflight request
        return '', 200
        
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        nama = data.get('nama')
        email = data.get('email')
        password = data.get('password')
        
        if not nama or not email or not password:
            return jsonify({'success': False, 'message': 'Semua field harus diisi'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email sudah terdaftar'}), 400
            
        password_hash = generate_password_hash(password)
        new_user = User(nama=nama, email=email, password=password_hash)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registrasi berhasil'})
    except Exception as e:
        print(f"Register error: {e}")
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Terjadi kesalahan server'}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def api_login():
    if request.method == 'OPTIONS':
        # Handle preflight request
        return '', 200
        
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email dan password harus diisi'}), 400
        
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            # Set status user menjadi online di semua tim yang diikuti
            team_members = TeamMember.query.filter_by(user_id=user.id).all()
            for member in team_members:
                member.status = 'online'
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'user_id': user.id, 
                'nama': user.nama, 
                'email': user.email, 
                'token': 'dummy-token'
            })
        return jsonify({'success': False, 'message': 'Email atau password salah'}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'success': False, 'message': 'Terjadi kesalahan server'}), 500

@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    user_id = request.args.get('user_id')
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404
    return jsonify({'success': True, 'user': {'id': user.id, 'nama': user.nama, 'email': user.email, 'role': user.role}})

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'User ID diperlukan'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404
        
        # Ambil tim-tim user
        user_teams = db.session.query(Team).join(TeamMember).filter(TeamMember.user_id == user_id).all()
        team_ids = [team.id for team in user_teams]
        
        # Statistik dasar
        total_teams = len(user_teams)
        total_members = db.session.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).count() if team_ids else 0
        
        # Sesi aktif
        active_sessions = db.session.query(Session).filter(
            Session.team_id.in_(team_ids),
            Session.status == 'active'
        ).count() if team_ids else 0
        
        # Data emosi 7 hari terakhir
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        emotion_stats = []
        for i in range(7):
            date = start_date + timedelta(days=i)
            day_name = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][date.weekday()]
            
            # Count emotions for this day
            day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            emotions = db.session.query(EmotionData).join(Session).filter(
                Session.team_id.in_(team_ids),
                EmotionData.timestamp >= day_start,
                EmotionData.timestamp < day_end
            ).all() if team_ids else []
            
            happy_count = sum(1 for e in emotions if e.emotion in ['happy', 'surprise'])
            neutral_count = sum(1 for e in emotions if e.emotion == 'neutral')
            sad_count = sum(1 for e in emotions if e.emotion in ['sad', 'fear'])
            angry_count = sum(1 for e in emotions if e.emotion in ['angry', 'disgust'])
            
            emotion_stats.append({
                'name': day_name,
                'senang': happy_count,
                'netral': neutral_count,
                'sedih': sad_count,
                'marah': angry_count
            })
        
        # Team members dengan status terbaru
        team_members_data = []
        if team_ids:
            members = db.session.query(User, TeamMember, Team).join(
                TeamMember, User.id == TeamMember.user_id
            ).join(
                Team, TeamMember.team_id == Team.id
            ).filter(TeamMember.team_id.in_(team_ids)).all()
            
            for user_obj, member_obj, team_obj in members:
                # Ambil emosi terbaru untuk member ini
                latest_emotion = db.session.query(EmotionData).join(Session).filter(
                    Session.team_id.in_(team_ids),
                    EmotionData.user_id == user_obj.id
                ).order_by(EmotionData.timestamp.desc()).first()
                
                mood_emoji = '😊'
                if latest_emotion:
                    if latest_emotion.emotion in ['happy', 'surprise']:
                        mood_emoji = '😊'
                    elif latest_emotion.emotion == 'neutral':
                        mood_emoji = '😐'
                    elif latest_emotion.emotion in ['sad', 'fear']:
                        mood_emoji = '😔'
                    elif latest_emotion.emotion in ['angry', 'disgust']:
                        mood_emoji = '😠'
                
                team_members_data.append({
                    'id': user_obj.id,
                    'name': user_obj.nama,
                    'role': member_obj.status,
                    'team': team_obj.name,
                    'mood': mood_emoji,
                    'lastActive': member_obj.status,
                    'is_online': member_obj.status in ['online', 'active']
                })
        
        # Hitung rata-rata mood dengan skala yang lebih realistis
        total_mood_score = 0
        mood_count = 0
        happy_members = 0
        neutral_members = 0
        sad_members = 0
        
        for member in team_members_data:
            if member['mood'] == '😊':
                total_mood_score += 85  # Senang = 85 (tidak sempurna 100)
                happy_members += 1
            elif member['mood'] == '😐':
                total_mood_score += 50  # Netral = 50 (tengah-tengah)
                neutral_members += 1
            else:
                total_mood_score += 20  # Sedih = 20 (bukan 0, masih ada harapan)
                sad_members += 1
            mood_count += 1
        
        avg_mood = (total_mood_score / mood_count) if mood_count > 0 else 50
        
        # Mood distribution data
        mood_distribution = [
            {'name': 'Senang', 'value': happy_members},
            {'name': 'Netral', 'value': neutral_members},
            {'name': 'Sedih', 'value': sad_members}
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'stats': {
                    'total_teams': total_teams,
                    'total_members': total_members,
                    'active_sessions': active_sessions,
                    'avg_mood': round(avg_mood)
                },
                'emotion_trend': emotion_stats,
                'team_members': team_members_data,
                'mood_distribution': mood_distribution
            }
        })
        
    except Exception as e:
        print(f"Error in dashboard stats: {str(e)}")
        return jsonify({'success': False, 'message': 'Terjadi kesalahan server'}), 500

@app.route('/api/teams', methods=['POST'])
def create_team():
    data = request.get_json()
    user_id = data.get('user_id')
    name = data.get('name')

    if not user_id or not name:
        return jsonify({'error': 'user_id dan name wajib diisi'}), 400

    kode_tim = f"TIM-{random.randint(1000, 9999)}"

    try:
         # Buat objek Team dan commit
        new_team = Team(name=name, code=kode_tim, creator_id=user_id)
        db.session.add(new_team)
        db.session.commit()

        # Tambah juga ke TeamMember sebagai ketua/moderator dengan status online
        new_member = TeamMember(user_id=user_id, team_id=new_team.id, is_moderator=True, status='online')
        db.session.add(new_member)
        db.session.commit()

        # Get creator info
        creator = User.query.get(user_id)

        return jsonify({
            'success': True,
            'tim': {
                'id': new_team.id,
                'name': new_team.name,
                'code': new_team.code,
                'creator_id': new_team.creator_id,
                'ketua_nama': creator.nama if creator else 'Unknown'
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print("Gagal membuat tim:", e)
        return jsonify({'error': 'Gagal membuat tim'}), 500


@app.route('/api/teams/join', methods=['POST'])
def join_team():
    data = request.get_json()
    kode = data.get('kode')
    user_id = data.get('user_id')

    if not kode or not user_id:
        return jsonify({'error': 'kode dan user_id wajib diisi'}), 400

    team = Team.query.filter_by(code=kode).first()
    if not team:
        return jsonify({'error': 'Kode tim tidak ditemukan'}), 404

    existing = TeamMember.query.filter_by(team_id=team.id, user_id=user_id).first()
    if existing:
        return jsonify({'error': 'Kamu sudah tergabung di tim ini'}), 400

    anggota_baru = TeamMember(user_id=user_id, team_id=team.id, is_moderator=False, status='online')
    db.session.add(anggota_baru)
    db.session.commit()

    # Kirim notifikasi ke ketua tim
    leader_id = team.creator_id
    user = User.query.get(user_id)
    from models import Notification
    notif = Notification(
        user_id=leader_id,
        type='join',
        message=f"{user.nama} bergabung ke tim Anda",
        data=None
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({
        'success': True,
        'tim': {
            'id': team.id,
            'name': team.name,
            'code': team.code
        }
    })

    



@app.route('/api/teams', methods=['GET'])
def api_teams():
    all_teams = Team.query.all()
    result = []
    for team in all_teams:
        # Get creator/ketua info
        creator = User.query.get(team.creator_id)
        
        anggota = TeamMember.query.filter_by(team_id=team.id).all()
        anggota_list = []
        for a in anggota:
            anggota_list.append({
                'id': a.user.id,
                'nama': a.user.nama,
                'name': a.user.nama,  # Alias untuk konsistensi frontend
                'email': a.user.email,
                'is_ketua': a.is_moderator or (a.user_id == team.creator_id),
                'is_moderator': a.is_moderator,
                'is_leader': a.is_moderator or (a.user_id == team.creator_id),
                'status': a.status or 'offline',  # Kirim status asli (online/offline)
                'emosi_terkini': 'neutral',
                'last_activity': None
            })
        result.append({
            'id': team.id,
            'nama': team.name,
            'kode': team.code,
            'creator_id': team.creator_id,
            'ketua_nama': creator.nama if creator else 'Unknown',
            'ketua_email': creator.email if creator else 'Unknown',
            'anggota': anggota_list
        })
    return jsonify({'success': True, 'tim': result})



@app.route('/api/my-teams/<int:user_id>', methods=['GET'])
def get_user_teams(user_id):
    memberships = TeamMember.query.filter_by(user_id=user_id).all()
    result = []
    for member in memberships:
        team = Team.query.get(member.team_id)
        if team:
            # Get creator/ketua info
            creator = User.query.get(team.creator_id)
            
            # Ambil semua anggota tim
            anggota = TeamMember.query.filter_by(team_id=team.id).all()
            anggota_list = []
            for a in anggota:
                anggota_list.append({
                    'id': a.user.id,
                    'nama': a.user.nama,
                    'name': a.user.nama,  # Alias untuk konsistensi frontend
                    'email': a.user.email,
                    'is_ketua': a.is_moderator or (a.user_id == team.creator_id),
                    'is_moderator': a.is_moderator,
                    'is_leader': a.is_moderator or (a.user_id == team.creator_id),
                    'status': a.status or 'offline',  # Kirim status asli (online/offline)
                    'emosi_terkini': 'neutral',
                    'last_activity': None
                })
            
            result.append({
                'id': team.id,
                'name': team.name,
                'code': team.code,
                'nama': team.name,  # Alias untuk konsistensi frontend
                'kode': team.code,  # Alias untuk konsistensi frontend
                'creator_id': team.creator_id,
                'ketua_nama': creator.nama if creator else 'Unknown',
                'ketua_email': creator.email if creator else 'Unknown',
                'is_ketua': team.creator_id == user_id,  # Apakah user saat ini adalah ketua
                'is_my_team': 1 if team.creator_id == user_id else 0,
                'jumlah_anggota': len(anggota_list),
                'anggota': anggota_list
            })
    return jsonify(result)


# Endpoint untuk Sesi
@app.route('/api/teams/<int:team_id>/sessions', methods=['POST'])
def create_session(team_id):
    try:
        data = request.get_json()
        creator_id = data.get('creator_id')
        title = data.get('title') or data.get('name')  # Terima baik 'title' maupun 'name'
        description = data.get('description')
        
        if not creator_id or not title:
            return jsonify({'error': 'creator_id dan title harus diisi'}), 400
        
        # Cek apakah tim exists
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Tim tidak ditemukan'}), 404
        
        # Cek apakah user adalah anggota tim
        member = TeamMember.query.filter_by(team_id=team_id, user_id=creator_id).first()
        if not member:
            return jsonify({'error': 'Anda bukan anggota tim ini'}), 403
        
        # Buat sesi baru
        new_session = Session(
            team_id=team_id,
            creator_id=creator_id,
            title=title,
            description=description,
            status='active'
        )
        
        db.session.add(new_session)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Sesi berhasil dibuat',
            'session': {
                'id': new_session.id,
                'title': new_session.title,
                'description': new_session.description,
                'status': new_session.status,
                'start_time': new_session.start_time.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating session: {e}")
        return jsonify({'error': 'Gagal membuat sesi'}), 500

@app.route('/api/sessions/<int:session_id>/end', methods=['POST'])
def end_session(session_id):
    data = request.json
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'success': False, 'message': 'User ID diperlukan'}), 400
    
    # Dapatkan sesi
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'success': False, 'message': 'Sesi tidak ditemukan'}), 404
    
    # Cek apakah user adalah moderator tim
    member = TeamMember.query.filter_by(team_id=session.team_id, user_id=user_id, is_moderator=True).first()
    if not member:
        return jsonify({'success': False, 'message': 'Hanya moderator yang dapat mengakhiri sesi'}), 403
    
    # Akhiri sesi
    session.status = 'completed'
    session.ended_at = db.func.current_timestamp()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sesi berhasil diakhiri'
    })

# Endpoint untuk menghentikan sesi
@app.route('/api/sessions/<int:session_id>/stop', methods=['POST'])
def stop_session(session_id):
    try:
        # Ambil sesi
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Sesi tidak ditemukan'}), 404
        
        # Update status sesi
        session.status = 'completed'
        session.end_time = db.func.current_timestamp()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Sesi berhasil dihentikan'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error stopping session: {e}")
        return jsonify({'error': 'Gagal menghentikan sesi'}), 500

# Endpoint untuk mengirim data emosi
@app.route('/api/sessions/<int:session_id>/emotion', methods=['POST'])
def submit_emotion(session_id):
    data = request.json
    user_id = data.get('user_id')
    emotion = data.get('emotion')
    confidence = data.get('confidence')
    print(f"[DEBUG] Submit emotion for session_id={session_id}, user_id={user_id}, emotion={emotion}, confidence={confidence}")
    
    if not all([user_id, emotion, confidence]):
        return jsonify({'success': False, 'message': 'Semua field harus diisi'}), 400
    
    session = Session.query.get(session_id)
    print(f"[DEBUG] Found session: {session}, status: {getattr(session, 'status', None)}")
    if not session or session.status != 'active':
        return jsonify({'success': False, 'message': 'Sesi tidak aktif atau tidak ditemukan'}), 400
    
    member = TeamMember.query.filter_by(team_id=session.team_id, user_id=user_id).first()
    if not member:
        return jsonify({'success': False, 'message': 'Anda bukan anggota tim ini'}), 403
    
    emotion_data = EmotionData(
        session_id=session_id,
        user_id=user_id,
        emotion=emotion,
        confidence=confidence
    )
    db.session.add(emotion_data)
    db.session.commit()

    # Jika emosi negatif, kirim notifikasi ke ketua
    if emotion in ['angry', 'sad', 'disgust', 'fear']:
        leader_id = session.team.creator_id
        user = User.query.get(user_id)
        from models import Notification
        notif = Notification(
            user_id=leader_id,
            type='emotion',
            message=f"Emosi negatif ({emotion}) terdeteksi dari {user.nama}",
            data=None
        )
        db.session.add(notif)
        db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Data emosi berhasil disimpan'
    })

# Endpoint untuk mendapatkan data emosi realtime
@app.route('/api/sessions/<int:session_id>/emotions', methods=['GET'])
def get_session_emotions(session_id):
    # Dapatkan sesi
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'success': False, 'message': 'Sesi tidak ditemukan'}), 404
    
    # Dapatkan data emosi terbaru untuk setiap user
    subquery = db.session.query(
        EmotionData.user_id,
        db.func.max(EmotionData.timestamp).label('max_timestamp')
    ).filter(
        EmotionData.session_id == session_id
    ).group_by(
        EmotionData.user_id
    ).subquery()
    
    latest_emotions = db.session.query(
        EmotionData, User.nama
    ).join(
        subquery,
        db.and_(
            EmotionData.user_id == subquery.c.user_id,
            EmotionData.timestamp == subquery.c.max_timestamp
        )
    ).join(
        User, User.id == EmotionData.user_id
    ).all()
    
    # Format data
    emotions = []
    for emotion_data, user_name in latest_emotions:
        emotions.append({
            'user_id': emotion_data.user_id,
            'user_name': user_name,
            'emotion': emotion_data.emotion,
            'confidence': emotion_data.confidence,
            'timestamp': emotion_data.timestamp.isoformat()
        })
    
    return jsonify({
        'success': True,
        'emotions': emotions,
        'session': {
            'id': session.id,
            'title': session.title,  # gunakan kolom yang benar
            'status': session.status,
            'start_time': session.start_time.isoformat() if session.start_time else None,
            'end_time': session.end_time.isoformat() if session.end_time else None
        }
    })

# Endpoint untuk mendapatkan seluruh riwayat emosi pada satu sesi
@app.route('/api/sessions/<int:session_id>/emotions/all', methods=['GET'])
def get_all_session_emotions(session_id):
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'success': False, 'message': 'Sesi tidak ditemukan'}), 404
    
    # Ambil semua data emosi untuk sesi ini, urutkan berdasarkan timestamp
    all_emotions = EmotionData.query.filter_by(session_id=session_id).order_by(EmotionData.timestamp.asc()).all()
    result = []
    for emotion in all_emotions:
        user = User.query.get(emotion.user_id)
        result.append({
            'user_id': emotion.user_id,
            'user_name': user.nama if user else 'Unknown',
            'emotion': emotion.emotion,
            'confidence': emotion.confidence,
            'timestamp': emotion.timestamp.isoformat()
        })
    return jsonify({'success': True, 'emotions': result})

# Endpoint untuk mendapatkan daftar anggota tim
@app.route('/api/teams/<int:team_id>/members', methods=['GET'])
def get_team_members(team_id):
    members = TeamMember.query.filter_by(team_id=team_id).all()
    
    result = []
    for member in members:
        result.append({
            'user_id': member.user_id,
            'name': member.user.nama,
            'email': member.user.email,
            'is_moderator': member.is_moderator,
            'status': member.status,
            'joined_at': member.joined_at.isoformat()
        })
    
    return jsonify({
        'success': True,
        'members': result
    })

@app.route('/api/riwayat', methods=['GET'])
def api_riwayat():
    try:
        # Ambil data riwayat real dari database
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id required'}), 400
            
        # Ambil sesi yang dibuat oleh user atau di tim yang diikuti user
        sessions = db.session.query(Session, Team.name.label('team_name')).join(
            Team, Team.id == Session.team_id
        ).join(
            TeamMember, TeamMember.team_id == Team.id
        ).filter(
            db.or_(
                Session.creator_id == user_id,
                TeamMember.user_id == user_id
            )
        ).order_by(Session.started_at.desc()).all()

        riwayat = []
        for session, team_name in sessions:
            riwayat.append({
                'id': session.id,
                'session': session.name,
                'team_name': team_name,
                'status': session.status,
                'started_at': session.started_at.isoformat(),
                'ended_at': session.ended_at.isoformat() if session.ended_at else None
            })

        return jsonify({'success': True, 'riwayat': riwayat})
    except Exception as e:
        print(f"Error getting riwayat: {e}")
        return jsonify({'error': 'Gagal mengambil riwayat'}), 500


    data = request.json
    status = data.get('status')  # online/offline
    emosi = data.get('emosi')    # happy/sad/angry/neutral
    
    # Update status di semua tim yang diikuti user
    for tim_id, members in team_members_detailed.items():
        for member in members:
            if member['id'] == user_id:
                if status:
                    member['status'] = status
                if emosi:
                    member['emosi_terkini'] = emosi
                member['last_activity'] = "2025-06-16 11:00:00"
    
    return jsonify({'success': True, 'message': 'Status berhasil diupdate'}), 200

def generate_team_code():
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# Endpoint untuk hapus anggota tim (hanya ketua)
@app.route('/api/teams/<int:team_id>/members/<int:user_id>', methods=['DELETE'])
def remove_team_member(team_id, user_id):
    try:
        # Ambil ketua_id dari parameter query atau body
        data = request.get_json() or {}
        ketua_id = data.get('ketua_id') or request.args.get('ketua_id')
        
        # Jika tidak ada ketua_id, ambil dari header Authorization atau session
        if not ketua_id:
            # Untuk sementara, kita bisa ambil dari user yang sedang login
            # Dalam implementasi real, ini biasanya dari JWT token
            return jsonify({'error': 'Ketua ID diperlukan dalam request'}), 400
        
        # Cek apakah user adalah ketua tim (creator)
        team = Team.query.get(team_id)
        if not team:
            return jsonify({'error': 'Tim tidak ditemukan'}), 404
            
        if int(team.creator_id) != int(ketua_id):
            return jsonify({'error': 'Anda bukan ketua tim ini'}), 403
        
        # Cek apakah ketua mencoba hapus dirinya sendiri
        if int(user_id) == int(ketua_id):
            return jsonify({'error': 'Ketua tim tidak dapat menghapus dirinya sendiri'}), 400
        
        # Hapus anggota dari tim
        member = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first()
        if not member:
            return jsonify({'error': 'Anggota tidak ditemukan di tim'}), 404
            
        db.session.delete(member)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Anggota berhasil dihapus dari tim'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error menghapus anggota tim: {e}")
        return jsonify({'error': 'Gagal menghapus anggota tim'}), 500

# Endpoint untuk update status user (online/offline)
@app.route('/api/user/status', methods=['POST'])
def update_user_status():
    data = request.get_json()
    user_id = data.get('user_id')
    status = data.get('status')  # 'online' atau 'offline'
    
    if not user_id or not status:
        return jsonify({'error': 'user_id dan status wajib diisi'}), 400
    
    if status not in ['online', 'offline']:
        return jsonify({'error': 'status harus online atau offline'}), 400
    
    # Update status di semua tim yang diikuti user
    team_members = TeamMember.query.filter_by(user_id=user_id).all()
    
    for member in team_members:
        member.status = status
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Status user berhasil diupdate menjadi {status}',
        'user_id': user_id,
        'status': status
    })

# Endpoint untuk menghapus tim (hanya ketua)
@app.route('/api/teams/<int:team_id>', methods=['DELETE', 'OPTIONS'])
def delete_team(team_id):
    if request.method == 'OPTIONS':
        # Handle preflight request
        return '', 200
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        print(f"Delete team request - team_id: {team_id}, user_id: {user_id}")
        if not user_id:
            return jsonify({'error': 'user_id required'}), 400
        # Cek apakah tim exists
        team = Team.query.get(team_id)
        if not team:
            print(f"Team {team_id} not found")
            return jsonify({'error': 'Tim tidak ditemukan'}), 404
        print(f"Team found: {team.name}, creator_id: {team.creator_id}")
        # Cek apakah user adalah ketua/creator tim
        if team.creator_id != user_id:
            print(f"User {user_id} is not the creator ({team.creator_id})")
            return jsonify({'error': 'Hanya ketua tim yang dapat menghapus tim'}), 403
        print("Starting deletion process...")
        # Hapus semua data emosi yang terkait dengan sesi di tim ini
        sessions = Session.query.filter_by(team_id=team_id).all()
        print(f"Found {len(sessions)} sessions to delete")
        for session in sessions:
            emotion_count = EmotionData.query.filter_by(session_id=session.id).count()
            print(f"Deleting {emotion_count} emotion records for session {session.id}")
            EmotionData.query.filter_by(session_id=session.id).delete()
        # Hapus semua sesi yang terkait dengan tim
        session_count = Session.query.filter_by(team_id=team_id).count()
        print(f"Deleting {session_count} sessions")
        Session.query.filter_by(team_id=team_id).delete()
        # Hapus semua anggota tim
        member_count = TeamMember.query.filter_by(team_id=team_id).count()
        print(f"Deleting {member_count} team members")
        TeamMember.query.filter_by(team_id=team_id).delete()
        # Hapus tim
        print(f"Deleting team {team.name}")
        db.session.delete(team)
        db.session.commit()
        print("Team deletion completed successfully")
        return jsonify({'success': True, 'message': 'Tim berhasil dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting team: {e}")
        print(f"Exception type: {type(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Gagal menghapus tim: {str(e)}'}), 500

# Endpoint untuk menghapus sesi (hanya creator/ketua)
@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id diperlukan'}), 400
        
        session_obj = Session.query.get(session_id)
        if not session_obj:
            return jsonify({'error': 'Sesi tidak ditemukan'}), 404
        
        # Cek apakah user adalah creator sesi
        if int(session_obj.creator_id) != int(user_id):
            return jsonify({'error': 'Hanya ketua/creator yang dapat menghapus sesi ini'}), 403
        
        # Hapus semua data emosi terkait sesi
        EmotionData.query.filter_by(session_id=session_id).delete()
        db.session.delete(session_obj)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Sesi berhasil dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting session: {e}")
        return jsonify({'error': 'Gagal menghapus sesi'}), 500

# Endpoint untuk mendapatkan riwayat sesi user
@app.route('/api/user/<int:user_id>/sessions', methods=['GET'])
def get_user_sessions(user_id):
    try:
        # Cek apakah user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User tidak ditemukan'}), 404
        
        # Ambil semua tim yang diikuti user
        team_memberships = TeamMember.query.filter_by(user_id=user_id).all()
        team_ids = [tm.team_id for tm in team_memberships]
        
        # Ambil semua sesi dari tim-tim tersebut atau yang dibuat oleh user
        sessions_query = Session.query.filter(
            db.or_(
                Session.creator_id == user_id,
                Session.team_id.in_(team_ids) if team_ids else False
            )
        ).order_by(Session.start_time.desc())
        
        sessions = sessions_query.all()

        # Format data
        session_list = []
        for session in sessions:
            # Ambil nama tim
            team = Team.query.get(session.team_id)
            team_name = team.name if team else "Unknown Team"
            
            session_list.append({
                'id': session.id,
                'name': session.title,  # Gunakan kolom yang benar
                'status': session.status,
                'started_at': session.start_time.isoformat(),  # Gunakan kolom yang benar
                'ended_at': session.end_time.isoformat() if session.end_time else None,  # Gunakan kolom yang benar
                'team_name': team_name
            })

        return jsonify({
            'success': True,
            'sessions': session_list
        })
    except Exception as e:
        print(f"Error getting user sessions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Gagal mengambil riwayat sesi: {str(e)}'}), 500

# Endpoint test untuk melihat semua sesi
@app.route('/api/sessions/all', methods=['GET'])
def get_all_sessions():
    try:
        sessions = Session.query.all()
        session_list = []
        for session in sessions:
            team = Team.query.get(session.team_id)
            session_list.append({
                'id': session.id,
                'name': session.name,
                'status': session.status,
                'started_at': session.started_at.isoformat(),
                'ended_at': session.ended_at.isoformat() if session.ended_at else None,
                'team_name': team.name if team else 'Unknown',
                'creator_id': session.creator_id,
                'team_id': session.team_id
            })
        
        return jsonify({
            'success': True,
            'sessions': session_list,
            'count': len(session_list)
        })
    except Exception as e:
        print(f"Error getting all sessions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- NOTIFICATION ENDPOINTS ---
@app.route('/api/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    notifs = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    result = []
    for n in notifs:
        result.append({
            'id': n.id,
            'type': n.type,
            'message': n.message,
            'data': n.data,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat()
        })
    return jsonify({'success': True, 'notifications': result})

@app.route('/api/notifications', methods=['POST'])
def create_notification():
    data = request.get_json()
    user_id = data.get('user_id')
    notif_type = data.get('type')
    message = data.get('message')
    extra = data.get('data')
    if not user_id or not notif_type or not message:
        return jsonify({'error': 'user_id, type, dan message wajib diisi'}), 400
    notif = Notification(user_id=user_id, type=notif_type, message=message, data=extra)
    db.session.add(notif)
    db.session.commit()
    return jsonify({'success': True, 'notification_id': notif.id})

@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_notification_read(notif_id):
    notif = Notification.query.get(notif_id)
    if not notif:
        return jsonify({'error': 'Notifikasi tidak ditemukan'}), 404
    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/reports/monthly', methods=['GET'])
def api_monthly_report():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'User ID diperlukan'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404
        
        # Ambil tim-tim user
        user_teams = db.session.query(Team).join(TeamMember).filter(TeamMember.user_id == user_id).all()
        team_ids = [team.id for team in user_teams]
        
        from datetime import datetime, timedelta
        # Data untuk bulan ini
        now = datetime.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
        
        # Statistik bulanan
        total_teams = len(user_teams)
        total_members = db.session.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).count() if team_ids else 0
        
        # Total sesi bulan ini
        monthly_sessions = db.session.query(Session).filter(
            Session.team_id.in_(team_ids),
            Session.start_time >= start_of_month,
            Session.start_time <= end_of_month
        ).count() if team_ids else 0
        
        # Sesi aktif (yang sedang berjalan saat ini)
        current_active_sessions = db.session.query(Session).filter(
            Session.team_id.in_(team_ids),
            Session.status == 'active'
        ).count() if team_ids else 0
        
        # Data emosi bulan ini
        monthly_emotions = db.session.query(EmotionData).join(Session).filter(
            Session.team_id.in_(team_ids),
            EmotionData.timestamp >= start_of_month,
            EmotionData.timestamp <= end_of_month
        ).all() if team_ids else []
        
        # Hitung distribusi emosi dengan detail timer
        emotion_counts = {
            'happy': 0, 'neutral': 0, 'sad': 0, 'angry': 0, 
            'surprise': 0, 'fear': 0, 'disgust': 0
        }
        emotion_durations = {
            'happy': [], 'neutral': [], 'sad': [], 'angry': [], 
            'surprise': [], 'fear': [], 'disgust': []
        }
        
        # Simulasi durasi emosi berdasarkan confidence dan timestamp
        for emotion in monthly_emotions:
            if emotion.emotion in emotion_counts:
                emotion_counts[emotion.emotion] += 1
                # Simulasi durasi berdasarkan confidence (semakin tinggi confidence, semakin lama durasi)
                duration = emotion.confidence * 5 + 2  # 2-7 detik range
                emotion_durations[emotion.emotion].append(duration)
        
        # Format distribusi emosi untuk frontend
        emotion_distribution = []
        emotion_mapping = {
            'happy': 'Senang',
            'neutral': 'Netral', 
            'sad': 'Sedih',
            'angry': 'Marah',
            'surprise': 'Terkejut',
            'fear': 'Takut',
            'disgust': 'Jijik'
        }
        
        total_emotions = sum(emotion_counts.values())
        for emotion_key, count in emotion_counts.items():
            if count > 0:
                avg_duration = sum(emotion_durations[emotion_key]) / len(emotion_durations[emotion_key])
                percentage = (count / total_emotions * 100) if total_emotions > 0 else 0
                
                emotion_distribution.append({
                    'name': emotion_mapping[emotion_key],
                    'value': count,
                    'percentage': round(percentage, 1),
                    'avg_duration': round(avg_duration, 1),
                    'total_duration': round(sum(emotion_durations[emotion_key]), 1)
                })
        
        # Rata-rata mood (simplified)
        total_emotions = sum(emotion_counts.values())
        if total_emotions > 0:
            positive_emotions = emotion_counts['happy'] + emotion_counts['surprise']
            negative_emotions = emotion_counts['sad'] + emotion_counts['angry'] + emotion_counts['fear'] + emotion_counts['disgust']
            neutral_emotions = emotion_counts['neutral']
            
            if positive_emotions >= negative_emotions and positive_emotions >= neutral_emotions:
                avg_mood = '😊'
            elif neutral_emotions >= negative_emotions:
                avg_mood = '😐'
            else:
                avg_mood = '😔'
        else:
            avg_mood = '😐'
        
        # Aktivitas harian untuk grafik
        daily_mood_data = []
        for day in range(1, 32):  # Maximum days in a month
            try:
                day_date = start_of_month.replace(day=day)
                if day_date > end_of_month:
                    break
                    
                day_start = day_date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                day_emotions = db.session.query(EmotionData).join(Session).filter(
                    Session.team_id.in_(team_ids),
                    EmotionData.timestamp >= day_start,
                    EmotionData.timestamp < day_end
                ).all() if team_ids else []
                
                happy_count = sum(1 for e in day_emotions if e.emotion in ['happy', 'surprise'])
                neutral_count = sum(1 for e in day_emotions if e.emotion == 'neutral')
                sad_count = sum(1 for e in day_emotions if e.emotion in ['sad', 'fear'])
                angry_count = sum(1 for e in day_emotions if e.emotion in ['angry', 'disgust'])
                
                daily_mood_data.append({
                    'date': day_date.strftime('%Y-%m-%d'),
                    'day': day,
                    'senang': happy_count,
                    'netral': neutral_count,
                    'sedih': sad_count,
                    'marah': angry_count,
                    'total': len(day_emotions)
                })
            except ValueError:
                # Invalid day for month (e.g., Feb 30)
                break
        
        # Aktivitas terbaru
        recent_activities = []
        recent_sessions = db.session.query(Session, Team).join(Team).filter(
            Session.team_id.in_(team_ids)
        ).order_by(Session.start_time.desc()).limit(10).all() if team_ids else []
        
        for session, team in recent_sessions:
            # Hitung durasi sesi
            if session.end_time:
                duration = session.end_time - session.start_time
                duration_str = f"{duration.seconds // 3600}j {(duration.seconds % 3600) // 60}m"
            else:
                duration_str = "Sedang berlangsung"
            
            # Hitung jumlah partisipan
            participants = db.session.query(EmotionData.user_id).filter(
                EmotionData.session_id == session.id
            ).distinct().count()
            
            recent_activities.append({
                'id': session.id,
                'title': session.title or f"Sesi {team.name}",
                'description': f"Sesi kolaborasi tim {team.name} dengan {participants} partisipan",
                'duration': duration_str,
                'status': session.status,
                'start_time': session.start_time.isoformat(),
                'team_name': team.name
            })
        
        # Tentukan emosi dominan
        dominant_emotion = 'Netral'
        if emotion_distribution:
            dominant_emotion = max(emotion_distribution, key=lambda x: x['value'])['name']
        
        # Hitung mood score berdasarkan distribusi
        mood_score = 50  # default
        if total_emotions > 0:
            positive_emotions = emotion_counts['happy'] + emotion_counts['surprise']
            negative_emotions = emotion_counts['sad'] + emotion_counts['angry'] + emotion_counts['fear'] + emotion_counts['disgust']
            neutral_emotions = emotion_counts['neutral']
            
            # Rumus mood score yang lebih realistis:
            # Positif = +1 point, Netral = 0.5 point, Negatif = 0 point
            # Kemudian dinormalisasi ke skala 0-100
            positive_score = positive_emotions * 1.0
            neutral_score = neutral_emotions * 0.5
            negative_score = negative_emotions * 0.0
            
            total_score = positive_score + neutral_score + negative_score
            max_possible_score = total_emotions * 1.0  # Jika semua emosi positif
            
            if max_possible_score > 0:
                mood_score = (total_score / max_possible_score) * 100
            else:
                mood_score = 50
                
            mood_score = max(0, min(100, mood_score))  # Ensure 0-100 range
        
        # Generate emotion trend data (weekly data for the month)
        emotion_trend = []
        weeks = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4']
        
        for i, week in enumerate(weeks):
            week_start = start_of_month + timedelta(days=i*7)
            week_end = min(week_start + timedelta(days=7), end_of_month)
            
            # Get emotions for this week
            week_emotions = db.session.query(EmotionData).join(Session).filter(
                Session.team_id.in_(team_ids),
                EmotionData.timestamp >= week_start,
                EmotionData.timestamp < week_end
            ).all() if team_ids else []
            
            # Count emotions for this week
            week_emotion_counts = {
                'senang': sum(1 for e in week_emotions if e.emotion in ['happy', 'surprise']),
                'netral': sum(1 for e in week_emotions if e.emotion == 'neutral'),
                'sedih': sum(1 for e in week_emotions if e.emotion in ['sad', 'fear']),
                'marah': sum(1 for e in week_emotions if e.emotion in ['angry', 'disgust'])
            }
            
            emotion_trend.append({
                'name': week,
                **week_emotion_counts
            })
        
        # Generate mood distribution (current status of team members)
        mood_distribution = []
        if team_ids:
            # Get team members and their recent mood status
            team_members = db.session.query(TeamMember, User).join(User).filter(
                TeamMember.team_id.in_(team_ids),
                TeamMember.status == 'active'
            ).all()
            
            # Simulate mood distribution based on recent emotions
            mood_counts = {'Senang': 0, 'Netral': 0, 'Sedih': 0, 'Marah': 0}
            
            for member, user in team_members:
                # Get user's most recent emotion
                recent_emotion = db.session.query(EmotionData).join(Session).filter(
                    Session.team_id.in_(team_ids),
                    EmotionData.user_id == user.id
                ).order_by(EmotionData.timestamp.desc()).first()
                
                if recent_emotion:
                    if recent_emotion.emotion in ['happy', 'surprise']:
                        mood_counts['Senang'] += 1
                    elif recent_emotion.emotion == 'neutral':
                        mood_counts['Netral'] += 1
                    elif recent_emotion.emotion in ['sad', 'fear']:
                        mood_counts['Sedih'] += 1
                    elif recent_emotion.emotion in ['angry', 'disgust']:
                        mood_counts['Marah'] += 1
                    else:
                        mood_counts['Netral'] += 1
                else:
                    # Default to neutral if no recent emotion
                    mood_counts['Netral'] += 1
            
            # Convert to format expected by frontend
            for mood_name, count in mood_counts.items():
                if count > 0:
                    mood_distribution.append({
                        'name': mood_name,
                        'value': count
                    })
        
        # If no mood data, provide sample data for testing
        if not mood_distribution:
            mood_distribution = [
                {'name': 'Senang', 'value': 5},
                {'name': 'Netral', 'value': 3},
                {'name': 'Sedih', 'value': 1},
                {'name': 'Marah', 'value': 1}
            ]
        
        return jsonify({
            'success': True,
            'data': {
                'summary': {
                    'total_teams': total_teams,
                    'total_members': total_members,
                    'monthly_sessions': monthly_sessions,  # Total sesi bulan ini
                    'active_sessions': current_active_sessions,  # Sesi yang sedang berjalan
                    'avg_mood_score': round(mood_score),
                    'dominant_emotion': dominant_emotion,
                    'total_emotions': total_emotions,
                    'total_detection_time': round(sum(
                        sum(durations) for durations in emotion_durations.values()
                    ), 1)
                },
                'emotion_distribution': emotion_distribution,
                'emotion_trend': emotion_trend,
                'mood_distribution': mood_distribution,
                'daily_mood_chart': daily_mood_data,
                'recent_activities': recent_activities,
                'period': {
                    'start': start_of_month.isoformat(),
                    'end': end_of_month.isoformat(),
                    'month_name': start_of_month.strftime('%B %Y')
                }
            }
        })
        
    except Exception as e:
        print(f"Error in monthly report: {str(e)}")
        return jsonify({'success': False, 'message': 'Terjadi kesalahan server'}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Buat user admin default jika belum ada
        admin_user = User.query.filter_by(email='admin@email.com').first()
        if not admin_user:
            admin_password = generate_password_hash('admin123')  # Password default: admin123
            admin_user = User(
                nama='Admin User',
                email='admin@email.com',
                password=admin_password,
                role='admin'
            )
            db.session.add(admin_user)
            db.session.commit()
            print("User admin default telah dibuat:")
            print("Email: admin@email.com")
            print("Password: admin123")
        else:
            # Update password admin jika sudah ada (untuk memastikan password yang diketahui)
            admin_user.password = generate_password_hash('admin123')
            db.session.commit()
            print("User admin sudah ada di database")
            print("Password admin telah diupdate ke: admin123")
            
    app.run(debug=True, host='0.0.0.0')
