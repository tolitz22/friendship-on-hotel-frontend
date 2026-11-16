# Friendship On Hotel — Frontend

React + Vite + TypeScript, TanStack Router, TanStack Query, Tailwind CSS v4. **Never replace with Next.js.**

Follow `docs/DESIGN_SYSTEM.md`; retain light and dark mode with semantic tokens and accessible contrast.
Use React Hook Form + Zod for validated forms, TanStack Table when advanced tables become necessary, and shadcn/ui-style reusable components.
Backend is in separate `friendship-on-hotel-backend` repository.
Current dashboard records are illustrative fixtures, never authoritative reservations.
Do not enable live booking, financial, or inventory mutation UI until backend requirements are approved and tested.
Prefer feature-local components, data hooks and API client.
Use semantic status badges; never rely on color alone.
Test all new workflows, loading/error/empty states, and accessibility.
Ensure responsive navigation and keyboard-accessible controls.
Never commit secrets or real guest personal information.