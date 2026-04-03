# RescueIQ 🍽️

## AI-Driven Food Surplus Prediction & Smart Redistribution Platform

RescueIQ is an intelligent platform that leverages machine learning and geospatial technology to predict food surplus across restaurants and facilitate seamless redistribution to NGOs and communities in need. Our mission is to reduce food waste while supporting social causes through smart technology.

---

## 🎯 Vision

Every year, millions of tons of food are wasted while many people face food insecurity. RescueIQ bridges this gap by:
- **Predicting** food surplus with AI before it becomes waste
- **Connecting** restaurants and food sources with organizations that need it
- **Tracking** social impact in real-time
- **Optimizing** logistics and distribution routes

---

## ✨ Key Features

### 🤖 AI & Prediction
- **Surplus Prediction Engine**: XGBoost-powered ML model that predicts daily food surplus based on historical data, weather, events, and trends
- **Smart Recommendations**: Automated suggestions for optimal donation amounts and timing
- **Pattern Analysis**: Identifies seasonal trends and anomalies in food waste

### 🗺️ Logistics & Mapping
- **Geospatial Matching**: Intelligent algorithm to match donors with recipients based on proximity and capacity
- **Route Optimization**: Google Maps integration for efficient delivery routes
- **Live Map View**: Real-time visualization of active donations and pickups

### 🏪 Donor Management
- **Restaurant Dashboard**: Intuitive interface for food donations and surplus reporting
- **Donation History**: Track all past donations with detailed analytics
- **Profile Management**: Manage restaurant details, operating hours, and preferences

### 🤝 NGO & Community Portal
- **Request Management**: Submit and track food requests with real-time status updates
- **Impact Dashboard**: Visualize social impact metrics - meals distributed, people served, emissions saved
- **Impact Scoring**: Contribute to leaderboards and recognition programs

### 💬 Smart Communication
- **NLP-Powered Chat**: Natural language processing for intelligent communication and notifications
- **Review System**: Rating and feedback mechanism for transparency and trust building
- **Automated Alerts**: Smart notifications for donation opportunities

### 🔐 Secure & Scalable
- **JWT Authentication**: Secure role-based access control (Restaurants, NGOs, Admins)
- **Data Encryption**: End-to-end encryption for sensitive information
- **Background Scheduling**: Automated tasks for retraining models and generating insights

---

## 🏗️ Architecture

### Backend Stack
- **Framework**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **ML/AI**: 
  - XGBoost for surplus prediction
  - Scikit-learn for data processing
  - Ollama for local LLM (NLP)
- **Authentication**: JWT with bcrypt
- **Task Scheduling**: APScheduler
- **APIs**: REST with CORS support

### Frontend Stack
- **Framework**: React 19 with Vite
- **Maps**: Leaflet & Google Maps API
- **Mobile**: Capacitor for iOS/Android
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Styling**: CSS3

### DevOps & Deployment
- **Database**: Supabase Cloud (PostgreSQL)
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime
- **Environment Management**: Python-dotenv

---

## 🚀 Quick Start

### Prerequisites
- Python 3.13+
- Node.js 22.19+ & npm 10.9+
- PostgreSQL (via Supabase)
- Git

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/Karunesh-18/RescueIQ.git
cd RescueIQ
```

#### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/Scripts/activate  # On Windows
# or
source .venv/bin/activate      # On macOS/Linux

# Install dependencies
pip install -r requirements-dev.txt

# Create .env file
cp .env.example .env
# Edit .env with your Supabase credentials
```

#### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file if needed
# Configure API endpoint: VITE_API_URL=http://localhost:8000
```

### Running Locally

#### Start Backend
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Backend runs on: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

#### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

---

## 📋 Environment Variables

### Backend (.env)
```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Ollama (Local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# App Settings
SURPLUS_THRESHOLD=10
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Scheduler
ENABLE_BACKGROUND_SCHEDULER=true
SCHEDULER_TIMEZONE=Asia/Kolkata
DAILY_PREDICT_HOUR=8
DAILY_PREDICT_MINUTE=0
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_KEY=your-google-maps-api-key
```

---

## 📚 API Documentation

### Core Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with credentials
- `POST /auth/me` - Get current user profile

#### Predictions
- `GET /predict/surplus/{restaurant_id}` - Get predicted surplus
- `POST /predict/retrain` - Trigger model retraining

#### Donations
- `POST /donations` - Create new donation
- `GET /donations/{id}` - Get donation details
- `PUT /donations/{id}` - Update donation status
- `GET /donations` - List donations with filters

#### NGOs
- `GET /ngos` - List all NGOs
- `GET /ngos/{id}` - Get NGO profile
- `POST /ngos/{id}/requests` - Create food request

#### Impact
- `GET /impact/dashboard` - Get impact metrics
- `GET /impact/leaderboard` - View rankings

#### Map Services
- `GET /map/nearby` - Find nearby donors/receivers
- `POST /map/route` - Get optimized route
- `GET /geocode/{address}` - Geocode address

#### NLP & Communication
- `POST /nlp/parse` - Parse natural language input
- `GET /reviews` - Get reviews and ratings

Full API documentation available at `/docs` when backend is running.

---

## 🔄 Workflow

1. **Restaurant adds surplus**: Manager reports surplus food via dashboard
2. **AI predicts amount**: System predicts optimal surplus based on ML model
3. **System matches**: Algorithm matches with nearby NGOs and communities
4. **Notifications sent**: Automated alerts to potential recipients
5. **Donation tracked**: Real-time status updates throughout process
6. **Impact recorded**: Meals served, people helped, emissions saved tracked
7. **Feedback collected**: Reviews and ratings for continuous improvement

---

## 📊 ML Model Details

### Surplus Predictor
- **Algorithm**: XGBoost Gradient Boosting
- **Input Features**:
  - Historical donation patterns
  - Day of week & time
  - Weather conditions
  - Seasonal factors
  - Special events/holidays
  - Restaurant capacity & popularity
- **Output**: Predicted surplus quantity with confidence intervals
- **Retraining**: Weekly automated retraining with new data

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 Project Structure

```
RescueIQ/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── database.py          # DB configuration
│   ├── requirements.txt      # Python dependencies
│   ├── models/              # Database models & schemas
│   ├── routers/             # API endpoints
│   │   ├── auth.py
│   │   ├── donations.py
│   │   ├── ngos.py
│   │   ├── predict.py
│   │   ├── impact.py
│   │   ├── map.py
│   │   ├── nlp.py
│   │   ├── reviews.py
│   │   └── ...
│   ├── ml/                  # Machine learning models
│   │   └── predictor.py
│   ├── services/            # Business logic
│   │   ├── matching.py
│   │   ├── scheduler.py
│   │   └── google_maps.py
│   └── seed/                # Database seeding scripts
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── api/             # API integration
│   │   ├── auth/            # Authentication context
│   │   └── assets/          # Static assets
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🐛 Troubleshooting

### Backend won't start
- Ensure `DATABASE_URL` is set in `.env`
- Check PostgreSQL/Supabase connection
- Verify all dependencies installed: `pip install -r requirements-dev.txt`

### Frontend connection issues
- Verify backend is running on `http://localhost:8000`
- Check `VITE_API_URL` environment variable
- Clear browser cache and restart dev server

### ML Model errors
- Ensure training data is available in Supabase
- Check Ollama is running (if using NLP features)
- Review logs in `/logs` directory

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Team

- **Karunesh** - Product Lead & Backend Development
- **Contributors** - Neemasree, yasish08

---

## 📞 Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Email: support@rescueiq.dev
- Check our documentation: [docs](./docs)

---

## 🌍 Impact

Join us in reducing food waste and fighting hunger!

- 🍽️ Reduce food waste
- 🤝 Strengthen communities
- 🌱 Build sustainable systems
- 📈 Track measurable impact

---

**RescueIQ** - Making food redistribution intelligent and impactful.
