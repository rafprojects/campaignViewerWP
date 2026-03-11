import type { Company } from '@/types';

export const companies: Company[] = [
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

export const getCompanyById = (companyId: string) =>
  companies.find((company) => company.id === companyId.toLowerCase());
