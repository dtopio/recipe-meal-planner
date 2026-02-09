# Recipe Meal Planner - Frontend

A modern, responsive Vue.js 3 frontend application for planning meals and managing recipes. Built with Vite for lightning-fast development and Tailwind CSS for beautiful, utility-first styling.

## Tech Stack

- **Vue.js 3** - Progressive JavaScript framework
- **Vite** - Next generation frontend build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Node.js** - JavaScript runtime (v16 or higher recommended)
- **npm** - Package manager

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) - Verify with `npm --version`
- **Git** - [Download](https://git-scm.com/)

## Installation & Setup

Follow these steps to set up the project on your local machine:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd recipe-meal-planner-front-end
```

### 2. Install Dependencies

```bash
npm install
```

This command will install all required packages listed in `package.json`.

### 3. Start Development Server

```bash
npm run dev
```

The application will start on `http://localhost:5173/` (or the next available port if 5173 is in use). Your browser should automatically open the application.

## Available Scripts

### Development

```bash
npm run dev
```

Starts the development server with hot module replacement (HMR). Any changes you make to the code will automatically refresh in the browser.

### Build for Production

```bash
npm run build
```

Creates an optimized production build in the `dist/` directory. The build is minified and ready for deployment.

### Preview Production Build

```bash
npm run preview
```

Locally preview the production build before deployment.

## Project Structure

```
recipe-meal-planner-front-end/
├── src/
│   ├── components/          # Reusable Vue components
│   ├── App.vue              # Root Vue component
│   ├── main.js              # Application entry point
│   └── style.css            # Global styles (with Tailwind directives)
├── public/                  # Static assets
├── index.html               # HTML entry point
├── package.json             # Project dependencies and scripts
├── package-lock.json        # Locked dependency versions
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
└── README.md                # This file
```

## Development Guidelines

### Vue Components

- Place reusable components in the `src/components/` directory
- Use Single File Components (.vue) format
- Follow Vue 3 Composition API or Options API conventions

### Styling with Tailwind CSS

Tailwind CSS is preconfigured. Use utility classes directly in your components:

```vue
<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      Click me
    </button>
  </div>
</template>
```

### Hot Module Replacement (HMR)

During development, Vue components automatically refresh when you save changes. This provides a fast development experience without losing application state.

## Building for Production

1. Run the build command:
   ```bash
   npm run build
   ```

2. The `dist/` folder will contain your production-ready application

3. Deploy the contents of the `dist/` folder to your hosting service

## Troubleshooting

### Port 5173 Already in Use

If port 5173 is already in use, Vite will automatically attempt to use the next available port. Check the terminal output to see which port is being used.

### Dependencies Installation Issues

If you encounter issues during `npm install`:

1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete `node_modules` and `package-lock.json`:
   ```bash
   rm -rf node_modules package-lock.json
   ```

3. Reinstall dependencies:
   ```bash
   npm install
   ```

### Build Errors

- Ensure all Vue components are properly formatted
- Check that component imports are correct
- Clear browser cache and rebuild if styles aren't updating

## Contributing

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "Add your commit message"
   ```

3. Push to the repository:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a Pull Request for team review

## Resources

- [Vue.js Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vue.js 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

## Team

This project is developed for **CSCI 441 - Final Project**.

## License

MIT

---

**Last Updated:** February 2026

For questions or issues, please contact the development team or create an issue in the repository.
