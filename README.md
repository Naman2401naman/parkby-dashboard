# 🚗 Smart Parking Dashboard

A **production-ready**, futuristic parking management system with real-time data visualization, built with React, Mapbox GL JS, Node.js, and MongoDB.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

---

## ✨ Features

### 🎨 Visual Excellence
- **Futuristic Dark Theme** with neon glows and space aesthetics
- **Color-Coded Parking Areas** (Green/Amber/Red based on availability)
- **Interactive Map** with Mapbox GL JS
- **Real-Time Labels** showing building names, availability %, and slot counts
- **Entry Point Markers** with glowing green dots
- **Floating Anti-Gravity Toolbar** with smooth animations

### 🔧 Technical Features
- **Real-Time Data Sync** with MongoDB
- **Auto-Save** on every draw/update/delete action
- **Smart Metadata Management** for parking slots
- **Persistent Storage** across sessions and users
- **RESTful API** for all CRUD operations
- **TypeScript** for type safety
- **Responsive Design** for all screen sizes

### 🚀 Production-Ready
- ✅ Error handling and loading states
- ✅ Safety timeouts for geolocation and API calls
- ✅ Clean, lint-free code
- ✅ Environment variable configuration
- ✅ Health check endpoints
- ✅ Comprehensive documentation

---

## 🖼️ Screenshots

### Main Dashboard
- Interactive map with parking areas
- Color-coded availability
- Real-time slot counts
- Entry point visualization

### Drawing Tools
- Parking Area creation
- Route drawing
- Gate placement
- Entry point marking

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Mapbox GL JS** - Map rendering
- **Mapbox GL Draw** - Drawing tools
- **Lucide React** - Icons
- **Tailwind CSS** - Styling

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **TypeScript** - Type safety
- **tsx** - TypeScript execution

---

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- Mapbox account (free tier works)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd parking-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Configure environment variables:**
   
   Create `.env` in root:
   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   VITE_API_URL=http://localhost:5000/api
   ```

   Create `backend/.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/parking-dashboard
   PORT=5000
   NODE_ENV=development
   ```

4. **Start the application:**
   
   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm run dev
   ```

   **Terminal 2 (Frontend):**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:5173
   ```

---

## 📖 Usage Guide

### Drawing Parking Areas
1. Click the **"Parking Area"** button
2. Click on the map to draw a polygon
3. Complete the shape by clicking the first point again
4. Enter the building name and total slots
5. The area auto-saves and displays on the map

### Adding Entry Points
1. Click the **"Entry Point"** button
2. Select a parking area from the list
3. Click on the map to place the entry marker
4. The entry point auto-saves

### Viewing Information
- **Parking areas** show name, availability %, and slot count
- **Colors** indicate availability:
  - 🟢 Green: 60%+ available
  - 🟡 Amber: 30-60% available
  - 🔴 Red: <30% available
- **Entry points** marked with bright green dots

### Editing & Deleting
- Click any shape to select it
- Drag vertices to edit
- Click **"Delete"** to remove selected items

---

## 🌐 API Endpoints

### Parking Areas
- `GET /api/parking-areas` - Get all parking areas
- `POST /api/parking-areas` - Create new parking area
- `PUT /api/parking-areas/:id` - Update parking area
- `DELETE /api/parking-areas/:id` - Delete parking area

### Routes
- `GET /api/routes` - Get all routes
- `POST /api/routes` - Create new route
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route

### Gates
- `GET /api/gates` - Get all gates
- `POST /api/gates` - Create new gate
- `PUT /api/gates/:id` - Update gate
- `DELETE /api/gates/:id` - Delete gate

### Metadata
- `GET /api/parking-metadata` - Get all metadata
- `GET /api/parking-metadata/name/:name` - Get by name
- `POST /api/parking-metadata` - Create metadata
- `PUT /api/parking-metadata/:id` - Update metadata

### Bulk
- `GET /api/map-data` - Get all data in one request

### Health
- `GET /health` - Check server status

---

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions covering:
- Traditional hosting (VPS/Cloud)
- Vercel + Railway
- Docker deployment
- Security checklist
- Performance optimization

---

## 📝 Documentation

- **[PRODUCTION_READY.md](./PRODUCTION_READY.md)** - Feature summary and status
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide
- **API Documentation** - See API Endpoints section above

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **Mapbox** for the amazing mapping platform
- **MongoDB** for the database
- **React** team for the framework
- **Lucide** for the beautiful icons

---

## 📧 Support

For issues and questions:
- Check the [Troubleshooting](#-troubleshooting) section
- Review browser console and server logs
- Open an issue on GitHub

---

## 🔄 Version History

### v1.0.0 (2026-02-13)
- ✅ Initial production release
- ✅ Full CRUD operations
- ✅ Real-time data sync
- ✅ Enhanced visual styling
- ✅ Production-ready deployment

---

**Built with ❤️ for smart parking management**
