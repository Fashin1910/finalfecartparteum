# Overview

MandalaMind is a biometric mandala generation application that creates personalized spiritual artwork based on real-time brainwave data from EEG devices and voice input. The system captures EEG signals from NeuroSky headsets, processes voice transcripts through speech recognition, and uses AI to generate custom mandala prompts that are then converted into visual artwork. The application provides a complete meditation and artistic creation experience with real-time biometric feedback visualization.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern React application using functional components, hooks, and strict TypeScript configuration
- **Vite Build System**: Fast development server with hot module replacement and optimized production builds
- **Shadcn/ui Component Library**: Comprehensive UI components built on Radix UI primitives with dark theme support
- **TailwindCSS**: Utility-first CSS framework with custom color variables and responsive design
- **Wouter**: Lightweight client-side routing solution
- **React Query**: Server state management, caching, and synchronization for API interactions
- **Canvas Visualization**: HTML5 Canvas for real-time EEG waveform rendering and brainwave visualization

## Backend Architecture
- **Express.js Server**: RESTful API server with TypeScript support and comprehensive error handling
- **WebSocket Integration**: Real-time bidirectional communication for streaming EEG data and device status
- **Modular Service Architecture**: Separate services for NeuroSky hardware integration and OpenAI processing
- **In-Memory Storage**: Simple storage implementation with interface design for future database integration
- **Shared Schema System**: Common TypeScript types and Zod validation schemas across frontend and backend

## Database Design
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL with schema migrations
- **Session Management**: User sessions track complete meditation experiences with brainwave data
- **Mandala Records**: Generated artwork with associated prompts, timestamps, and biometric context
- **EEG Data Storage**: Time-series brainwave data with attention, meditation, and signal quality metrics
- **Relational Structure**: Proper foreign key relationships between sessions, mandalas, and EEG readings

## Core Features
- **Real-Time Biometric Monitoring**: Continuous EEG data capture with WebSocket streaming to frontend
- **Voice Recognition**: Browser-based speech-to-text API for meditation prompts and intentions
- **AI-Powered Art Generation**: OpenAI GPT integration for intelligent mandala prompt creation based on biometric data
- **Device Management**: NeuroSky headset connection, status monitoring, and demo mode support
- **Mandala Gallery**: Image display, download functionality, and QR code sharing capabilities

## Integration Patterns
- **Hardware Integration**: Serial/USB communication with NeuroSky devices via ThinkGear Connector
- **AI Service Integration**: OpenAI API calls with retry logic and fallback handling
- **Real-Time Data Flow**: WebSocket-based streaming architecture for continuous biometric feedback
- **Responsive Design**: Mobile-first approach with adaptive layouts and touch-friendly interactions

# External Dependencies

## Hardware Integration
- **NeuroSky ThinkGear**: EEG headset connectivity via serial/USB interface for brainwave capture
- **ThinkGear Connector**: Local WebSocket server running on port 13854 for device communication

## AI and Language Services
- **OpenAI API**: GPT-5 model for intelligent mandala prompt generation and natural language processing
- **Browser Speech Recognition**: Web Speech API for voice-to-text transcription in Portuguese (pt-BR)

## Database and Infrastructure
- **PostgreSQL**: Primary database configured via Drizzle ORM with connection pooling
- **Neon Database**: Serverless PostgreSQL provider with connection string configuration

## Development and Build Tools
- **Replit Integration**: Custom Vite plugins for Replit environment with runtime error overlays
- **PostCSS and Autoprefixer**: CSS processing pipeline for cross-browser compatibility
- **ESBuild**: Fast JavaScript bundling for production server builds