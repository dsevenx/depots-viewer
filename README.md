# Depots Viewer

A modern, mobile-responsive web application for viewing and managing investment portfolios, built with Next.js and deployed on Azure Static Web Apps.

## Features

- 📱 **Mobile-First Design**: Fully responsive interface optimized for iPhone and all mobile devices
- 🎨 **Modern UI**: Built with Tailwind CSS v4 for a clean, professional look
- 🌓 **Dark Mode**: Automatic dark mode support based on system preferences
- ⚡ **Fast Performance**: Static site generation for optimal loading speeds
- 🔒 **Type-Safe**: Built with TypeScript for robust code quality
- ☁️ **Azure Deployment**: Automated deployment to Azure Static Web Apps via GitHub Actions

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Deployment**: [Azure Static Web Apps](https://azure.microsoft.com/en-us/services/app-service/static/)
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd depots-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build

To create a production build:

```bash
npm run build
```

This generates a static export in the `out` directory.

## Deployment to Azure

### Setup

1. Create an Azure Static Web App in your Azure Portal
2. Copy the deployment token from Azure
3. Add the token as a GitHub secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Push to the `main` branch to trigger automatic deployment

### GitHub Actions

The project includes a pre-configured GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) that automatically:

- Builds the application on every push to `main`
- Deploys to Azure Static Web Apps
- Creates preview deployments for pull requests
- Cleans up preview deployments when PRs are closed

## Project Structure

```
depots-viewer/
├── app/
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles and Tailwind imports
├── public/              # Static assets
├── .github/
│   └── workflows/       # GitHub Actions workflows
├── next.config.ts       # Next.js configuration
├── tailwind.config.ts   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Mobile Optimization

The application is optimized for mobile devices with:

- Responsive viewport settings
- Touch-friendly UI elements
- Adaptive layouts using Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- Optimized images and assets

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly on mobile and desktop
4. Submit a pull request

## License

MIT
