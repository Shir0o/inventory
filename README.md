# Lit-Ledger (Inventory Website)

A modern, responsive inventory and event management web application built with React, TypeScript, Tailwind CSS, and Firebase.

## Features

- **Item Tracking:** Real-time stock levels, category assignments, barcodes, and audit history.
- **Event-Driven Inventory:** Check-out and return items linked directly to scheduled events.
- **AI Integration:** Smart categorization and parsing powered by Google Gemini API.
- **Role-Based Access Control:** Secure three-tier permissions backed by Firebase Auth and Firestore Security Rules.
- **PDF & Label Export:** Printable item lists, packing sheets, and barcode summaries.

## Getting Started

### Prerequisites

- Node.js (18+ recommended)
- npm or pnpm
- Firebase project credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/Shir0o/inventory.git
cd inventory

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

## Build & Test

```bash
# Production build
npm run build

# Run tests
npm test
```

## License

This project is licensed under the [MIT License](LICENSE).
