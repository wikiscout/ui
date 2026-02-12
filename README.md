# WikiScout UI

This is the main UI application for WikiScout (dashboard and mobile views).

## Structure

- `dashboard.html` - Main desktop dashboard
- `mobile.html` - Mobile scouting interface
- `card.html` - Trading card view
- `code.html` - OTP code entry page
- `index.html` - Main entry point
- `upload.html` - Photo upload interface
- `css/` - Stylesheets
  - `base.css` - Base styles
  - `components.css` - Component styles
  - `dashboard.css` - Dashboard-specific styles
  - `mobile.css` - Mobile-specific styles
  - `variables.css` - CSS variables
- `js/` - JavaScript files
  - `api.js` - API client
  - `dashboard-app.js` - Dashboard application logic
  - `mobile-app.js` - Mobile application logic
  - `icons.js` - Icon system
  - `utils.js` - Utility functions
  - `view-detector.js` - View detection
- `assets/` - Static assets (images, etc.)

## Usage

These files are served statically and communicate with the API backend (either PHP or TypeScript API).

## Deployment

Deploy to a static hosting service (Cloudflare Pages, Netlify, etc.) or serve via a web server.
