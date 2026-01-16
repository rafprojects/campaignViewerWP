# WP Super Gallery - Architecture Plan

## Overview

A React-based card gallery component that can be embedded in WordPress via a plugin or deployed as a standalone SPA. Each card represents a campaign for a company and expands into a "mini-site" showcasing media content.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Card Gallery│  │ Campaign    │  │ Admin Panel             │  │
│  │ (Main View) │  │ Mini-Site   │  │ (User/Permission Mgmt)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Auth Context / State Management              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend / API                            │
├─────────────────────────────────────────────────────────────────┤
│  Option A: WordPress REST API + Custom Plugin                   │
│  Option B: Standalone Node.js/Express API                       │
│  Option C: Firebase/Supabase (BaaS)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
wp-super-gallery/
├── src/
│   ├── components/
│   │   ├── Gallery/
│   │   │   ├── CardGallery.tsx        # Main gallery grid
│   │   │   ├── CampaignCard.tsx       # Individual card
│   │   │   └── CardFilters.tsx        # Filter by company/tags
│   │   ├── Campaign/
│   │   │   ├── CampaignViewer.tsx     # Expanded "mini-site"
│   │   │   ├── VideoCarousel.tsx      # Video player carousel
│   │   │   ├── ImageCarousel.tsx      # Image gallery carousel
│   │   │   └── CampaignHeader.tsx     # Campaign title/info
│   │   ├── Admin/
│   │   │   ├── AdminPanel.tsx         # Main admin dashboard
│   │   │   ├── UserManagement.tsx     # CRUD for users
│   │   │   └── PermissionEditor.tsx   # Assign campaigns to users
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── LockedCard.tsx         # Visual for inaccessible cards
│   │   └── ui/                        # Shared UI components
│   ├── contexts/
│   │   └── AuthContext.tsx            # Auth state & user permissions
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCampaigns.ts
│   │   └── usePermissions.ts
│   ├── services/
│   │   ├── api.ts                     # API client
│   │   ├── authService.ts
│   │   └── campaignService.ts
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── public/
├── docs/
│   └── ARCHITECTURE.md
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔐 Authentication Approaches

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **WordPress Auth** | Native WP users, existing infrastructure | Tied to WP, complex CORS | WP-first deployment |
| **Firebase Auth** | Easy setup, multiple providers, real-time DB | External dependency, costs scale | Quick MVP, SPA-first |
| **Supabase** | Open-source, PostgreSQL, row-level security | Newer ecosystem | Full control + managed |
| **Custom JWT** | Full control, portable | More dev work | Enterprise/custom needs |

### Recommendation: Supabase or Firebase

These provide:
- User authentication (email, social logins)
- Row-level security (users only see permitted campaigns)
- Easy admin management
- Works identically in WP-embed or standalone SPA

---

## 📊 Data Models

```typescript
interface Company {
  id: string;
  name: string;
  logo: string;
  brandColor: string;
}

interface Campaign {
  id: string;
  companyId: string;
  title: string;
  description: string;
  thumbnail: string;
  coverImage: string;
  videos: MediaItem[];
  images: MediaItem[];
  tags: string[];
  createdAt: Date;
  isPublic: boolean;  // Public campaigns need no auth
}

interface MediaItem {
  id: string;
  type: 'video' | 'image';
  url: string;
  thumbnail?: string;
  caption?: string;
  order: number;
}

interface User {
  id: string;
  email: string;
  role: 'viewer' | 'admin';
  permissions: string[];  // Array of campaign IDs user can access
}
```

---

## 🎨 User Experience Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CARD GALLERY (Main View)                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ 🔓 Card │  │ 🔒 Card │  │ 🔓 Card │  │ 🔒 Card │            │
│  │ Nike    │  │ Adidas  │  │ Nike    │  │ Puma    │            │
│  │ Summer  │  │ Winter  │  │ Fall    │  │ Spring  │            │
│  └────┬────┘  └─────────┘  └────┬────┘  └─────────┘            │
│       │ click                   │                               │
└───────┼─────────────────────────┼───────────────────────────────┘
        │                         │
        ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              CAMPAIGN MINI-SITE (Expanded View)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [← Back]              Nike Summer 2026                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │           VIDEO CAROUSEL                        │    │   │
│  │  │    [◀]  [ ▶ Video Player ]  [▶]                │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │           IMAGE CAROUSEL                        │    │   │
│  │  │    [img1] [img2] [img3] [img4] [img5]          │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Phases

### Phase 1: Core Gallery (MVP)
- [ ] Project setup (Vite + React + TypeScript)
- [ ] Card Gallery component with mock data
- [ ] Campaign mini-site viewer with carousels
- [ ] Responsive design
- [ ] Basic animations (card expand/collapse)

### Phase 2: Authentication
- [ ] Set up auth provider (Firebase/Supabase)
- [ ] Login/logout flow
- [ ] Permission checking on card access
- [ ] Locked card visual states

### Phase 3: Admin Panel
- [ ] Admin-only route protection
- [ ] User management CRUD
- [ ] Permission assignment UI
- [ ] Campaign management (optional)

### Phase 4: WordPress Integration
- [ ] Build as embeddable widget
- [ ] WordPress plugin wrapper
- [ ] Shortcode support `[super-gallery]`
- [ ] WP REST API integration (if using WP auth)

### Phase 5: Polish
- [ ] Loading states & skeletons
- [ ] Error handling
- [ ] Analytics tracking
- [ ] Performance optimization

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: React Context + hooks
- **Routing**: React Router v6

### Backend Options
- **Option A**: Supabase (recommended for MVP)
- **Option B**: Firebase
- **Option C**: WordPress REST API

### Media
- Video hosting: YouTube/Vimeo embeds or self-hosted
- Image hosting: CDN (Cloudinary, ImageKit, or self-hosted)

---

## 📝 Key Decisions to Make

1. **Auth Provider**: Firebase, Supabase, or WordPress native?
2. **Data Storage**: Where will campaigns/media be stored?
3. **Video Hosting**: YouTube/Vimeo embeds vs self-hosted?
4. **Deployment**: Vercel, Netlify, or WordPress-only?

---

## 📅 Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Core Gallery | 1-2 weeks | None |
| Phase 2: Authentication | 1 week | Auth provider decision |
| Phase 3: Admin Panel | 1-2 weeks | Phase 2 |
| Phase 4: WP Integration | 1 week | Phase 1-3 |
| Phase 5: Polish | 1 week | All phases |

**Total Estimated Time**: 5-8 weeks

---

*Document created: January 15, 2026*
