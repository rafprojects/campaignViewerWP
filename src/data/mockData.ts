import type { Campaign, Company } from '@/types';

const companies: Company[] = [
  {
    id: 'nike',
    name: 'Nike',
    logo: '🏃',
    brandColor: '#FF6B00',
  },
  {
    id: 'adidas',
    name: 'Adidas',
    logo: '⚽',
    brandColor: '#000000',
  },
  {
    id: 'apple',
    name: 'Apple',
    logo: '🍎',
    brandColor: '#555555',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    logo: '🎵',
    brandColor: '#1DB954',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    logo: '🎬',
    brandColor: '#E50914',
  },
  {
    id: 'tesla',
    name: 'Tesla',
    logo: '🚗',
    brandColor: '#CC0000',
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    companyId: 'nike',
    company: companies[0],
    title: 'Summer Rush 2026',
    description: 'High-energy summer campaign featuring top athletes pushing their limits in extreme heat conditions.',
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v1', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=300&h=200&fit=crop', caption: 'Main Campaign Video', order: 1 },
      { id: 'v2', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=300&h=200&fit=crop', caption: 'Behind the Scenes', order: 2 },
    ],
    images: [
      { id: 'i1', type: 'image', url: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&h=600&fit=crop', caption: 'Hero Shot', order: 1 },
      { id: 'i2', type: 'image', url: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&h=600&fit=crop', caption: 'Product Detail', order: 2 },
      { id: 'i3', type: 'image', url: 'https://images.unsplash.com/photo-1491553895911-0055uj6bf?w=800&h=600&fit=crop', caption: 'Lifestyle', order: 3 },
      { id: 'i4', type: 'image', url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&h=600&fit=crop', caption: 'Action Shot', order: 4 },
    ],
    tags: ['summer', 'sports', 'running'],
    createdAt: new Date('2026-01-10'),
    isPublic: false,
  },
  {
    id: '2',
    companyId: 'adidas',
    company: companies[1],
    title: 'Street Culture',
    description: 'Urban streetwear collection celebrating city life and underground culture.',
    thumbnail: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v3', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=300&h=200&fit=crop', caption: 'Launch Video', order: 1 },
    ],
    images: [
      { id: 'i5', type: 'image', url: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=800&h=600&fit=crop', caption: 'Street Style', order: 1 },
      { id: 'i6', type: 'image', url: 'https://images.unsplash.com/photo-1520316587275-5e5c73027ae3?w=800&h=600&fit=crop', caption: 'Urban Setting', order: 2 },
    ],
    tags: ['urban', 'streetwear', 'culture'],
    createdAt: new Date('2026-01-05'),
    isPublic: false,
  },
  {
    id: '3',
    companyId: 'apple',
    company: companies[2],
    title: 'Vision Pro Launch',
    description: 'Revolutionary spatial computing experience unveiling the future of technology.',
    thumbnail: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v4', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=300&h=200&fit=crop', caption: 'Product Reveal', order: 1 },
    ],
    images: [
      { id: 'i7', type: 'image', url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop', caption: 'Device Shot', order: 1 },
      { id: 'i8', type: 'image', url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=600&fit=crop', caption: 'In Use', order: 2 },
      { id: 'i9', type: 'image', url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=600&fit=crop', caption: 'Detail', order: 3 },
    ],
    tags: ['tech', 'innovation', 'VR'],
    createdAt: new Date('2026-01-12'),
    isPublic: true,
  },
  {
    id: '4',
    companyId: 'spotify',
    company: companies[3],
    title: 'Wrapped 2025',
    description: 'Annual music retrospective celebrating the sounds that defined the year.',
    thumbnail: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v5', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=300&h=200&fit=crop', caption: 'Wrapped Reveal', order: 1 },
    ],
    images: [
      { id: 'i10', type: 'image', url: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=800&h=600&fit=crop', caption: 'Key Visual', order: 1 },
    ],
    tags: ['music', 'annual', 'data'],
    createdAt: new Date('2025-12-01'),
    isPublic: false,
  },
  {
    id: '5',
    companyId: 'netflix',
    company: companies[4],
    title: 'Stranger Things S5',
    description: 'The epic conclusion to the beloved series - marketing campaign materials.',
    thumbnail: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v6', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=300&h=200&fit=crop', caption: 'Official Trailer', order: 1 },
      { id: 'v7', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300&h=200&fit=crop', caption: 'Teaser', order: 2 },
    ],
    images: [
      { id: 'i11', type: 'image', url: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=800&h=600&fit=crop', caption: 'Key Art', order: 1 },
      { id: 'i12', type: 'image', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=600&fit=crop', caption: 'Scene Still', order: 2 },
    ],
    tags: ['entertainment', 'series', 'sci-fi'],
    createdAt: new Date('2026-01-08'),
    isPublic: true,
  },
  {
    id: '6',
    companyId: 'tesla',
    company: companies[5],
    title: 'Cybertruck Launch',
    description: 'Revolutionary electric truck redefining utility vehicles for the future.',
    thumbnail: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=400&h=300&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=1200&h=600&fit=crop',
    videos: [
      { id: 'v8', type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=300&h=200&fit=crop', caption: 'Unveil Event', order: 1 },
    ],
    images: [
      { id: 'i13', type: 'image', url: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?w=800&h=600&fit=crop', caption: 'Hero Shot', order: 1 },
      { id: 'i14', type: 'image', url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&h=600&fit=crop', caption: 'Interior', order: 2 },
    ],
    tags: ['automotive', 'electric', 'innovation'],
    createdAt: new Date('2026-01-02'),
    isPublic: false,
  },
];

// Simulated user permissions - in real app this comes from auth
export const mockUserPermissions = ['1', '3', '5']; // User can access campaigns 1, 3, 5
