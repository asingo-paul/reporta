# Reporta Frontend

Modern, responsive frontend for Reporta - Your major report helper.

## Features

- 🎨 Modern UI with Tailwind CSS
- 🔐 Authentication (Login/Signup)
- 📊 Dashboard with analytics overview
- 👥 Client management
- 📈 Report generation and viewing
- 🔌 Integration management (GA4, Google Ads, Meta)
- 💳 Billing/Subscription management
- 🎨 Custom template editor
- 📱 Fully responsive design

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool
- **React Router** - Navigation
- **Zustand** - State management
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **date-fns** - Date formatting
- **Recharts** - Data visualization

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL (default is http://localhost:8080/api/v1)

4. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Navbar.jsx
│   └── ProtectedRoute.jsx
├── pages/           # Page components
│   ├── Landing.jsx
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx
│   ├── Clients.jsx
│   └── ClientDetail.jsx
├── store/           # State management
│   └── authStore.js
├── lib/            # Utilities and API client
│   └── api.js
├── App.jsx         # Main app component
├── main.jsx        # Entry point
└── index.css       # Global styles
```

## API Integration

The frontend connects to the Reporta API backend. Make sure the backend is running before starting the frontend.

API configuration is in `src/lib/api.js` and uses the `VITE_API_URL` environment variable.

### Authentication

- JWT tokens are stored in localStorage
- Automatic token refresh on 401 responses
- Protected routes redirect to login if not authenticated

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Environment Variables

Create a `.env` file with:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Features by Page

### Landing Page
- Hero section with CTA
- Features showcase
- How it works section
- Pricing information
- Footer

### Authentication
- Login with email/password
- Signup with validation
- Password strength indicator
- Error handling

### Dashboard
- Quick stats overview
- Recent reports list
- Quick actions
- Pending reports

### Clients
- List all clients
- Search/filter clients
- Add new client
- Edit/delete clients
- View client details

### Client Detail
- Client information
- Integration management (GA4, Google Ads, Meta)
- Reports list for client
- Generate new report

## Styling

The app uses Tailwind CSS with a custom configuration. Theme colors and utilities are defined in `tailwind.config.js`.

Custom CSS classes are available:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`
- `.input`
- `.card`
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-error`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - All rights reserved
