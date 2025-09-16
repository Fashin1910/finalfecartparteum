# Overview

MandalaMind is a biometric mandala generation application that creates personalized spiritual artwork based on real-time brainwave data from EEG devices and voice input. The system captures EEG signals from NeuroSky headsets, processes voice input for meditation intentions, and uses AI to generate unique mandala artwork that reflects the user's mental state and spiritual goals.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern React application using functional components, hooks, and strict TypeScript configuration for type safety
- **Vite Build System**: Fast development server with hot module replacement and optimized production builds
- **Shadcn/ui Component Library**: Comprehensive UI components built on Radix UI primitives with dark theme support and accessibility features
- **TailwindCSS**: Utility-first CSS framework with custom color variables, responsive design, and dark mode theming
- **Wouter**: Lightweight client-side routing solution for SPA navigation
- **React Query**: Server state management, caching, and synchronization for API interactions with automatic background refetching
- **Canvas Visualization**: HTML5 Canvas for real-time EEG waveform rendering and brainwave visualization with smooth animations

## Backend Architecture
- **Express.js Server**: RESTful API server with TypeScript support, comprehensive error handling, and middleware stack
- **WebSocket Integration**: Real-time bidirectional communication for streaming EEG data and device status updates
- **Modular Service Architecture**: Separate services for NeuroSky hardware integration, Gemini AI processing, and OpenAI fallback
- **In-Memory Storage**: Simple storage implementation with well-defined interfaces for future database integration
- **Shared Schema System**: Common TypeScript types and Zod validation schemas shared between frontend and backend

## Database Design
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL with schema migrations and query building
- **Session Management**: User sessions track complete meditation experiences with brainwave data and generated content
- **Mandala Records**: Generated artwork storage with associated prompts, timestamps, and biometric context data
- **EEG Data Storage**: Time-series brainwave data with attention, meditation, and signal quality metrics
- **Relational Structure**: Proper foreign key relationships between sessions, mandalas, and EEG readings for data integrity

## Core Features
- **Real-Time Biometric Monitoring**: Continuous EEG data capture from NeuroSky devices with WebSocket streaming to frontend
- **Voice Recognition**: Browser-based Web Speech API for meditation prompts and intention capture with Portuguese language support
- **AI-Powered Art Generation**: Primary Gemini AI integration with OpenAI fallback for intelligent mandala prompt creation based on biometric data
- **Device Management**: NeuroSky headset connection, status monitoring, demo mode support, and ThinkGear Connector integration
- **Mandala Gallery**: Image display, download functionality, QR code sharing, and generated artwork management

## Integration Patterns
- **Hardware Integration**: Serial/USB communication with NeuroSky devices via ThinkGear Connector local WebSocket server
- **AI Service Integration**: Primary Gemini AI with OpenAI fallback, retry logic, and error handling for prompt generation
- **Real-Time Data Flow**: WebSocket-based streaming architecture for continuous biometric feedback and device status
- **Responsive Design**: Mobile-first approach with adaptive layouts, touch-friendly interactions, and cross-device compatibility

# External Dependencies

## Hardware Integration
- **NeuroSky ThinkGear**: EEG headset connectivity via serial/USB interface for brainwave capture and monitoring
- **ThinkGear Connector**: Local WebSocket server (port 13854) for device communication and data streaming

## AI Services
- **Google Gemini AI**: Primary AI service using Gemini 2.5 Flash model for intelligent mandala prompt generation
- **OpenAI**: Fallback AI service with GPT-5 model for prompt generation when Gemini is unavailable
- **Web Speech API**: Browser-native speech recognition for voice input and meditation intention capture

## Database & Hosting
- **Neon Database**: Serverless PostgreSQL database for production data storage
- **Replit Integration**: Development environment with custom Vite plugins and runtime error handling