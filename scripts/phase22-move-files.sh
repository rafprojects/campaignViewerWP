#!/bin/bash
# Phase 1: File Reorganization — git mv operations
# Run from project root: bash scripts/phase22-move-files.sh
set -euo pipefail

echo "=== Phase 22 Extended — Phase 1: File Moves ==="
echo ""

# 1. Create new directories
echo "Creating directories..."
mkdir -p src/components/CampaignGallery
mkdir -p src/components/CardViewer
mkdir -p src/components/Galleries/Adapters
mkdir -p src/components/Galleries/Shared
mkdir -p src/components/Common

# 2. Move Gallery/ → CampaignGallery/
echo "Moving Gallery/ → CampaignGallery/..."
git mv src/components/Gallery/CardGallery.tsx          src/components/CampaignGallery/
git mv src/components/Gallery/CardGallery.module.scss   src/components/CampaignGallery/
git mv src/components/Gallery/CardGallery.test.tsx      src/components/CampaignGallery/
git mv src/components/Gallery/CampaignCard.tsx          src/components/CampaignGallery/
git mv src/components/Gallery/CampaignCard.module.scss  src/components/CampaignGallery/
git mv src/components/Gallery/LazyImage.tsx             src/components/CampaignGallery/
git mv src/components/Gallery/RequestAccessForm.tsx     src/components/CampaignGallery/
git mv src/components/Gallery/RequestAccessForm.test.tsx src/components/CampaignGallery/

# 3. Move CampaignViewer files → CardViewer/
echo "Moving CampaignViewer → CardViewer/..."
git mv src/components/Campaign/CampaignViewer.tsx        src/components/CardViewer/
git mv src/components/Campaign/CampaignViewer.module.scss src/components/CardViewer/
git mv src/components/Campaign/CampaignViewer.test.tsx   src/components/CardViewer/

# 4. Move gallery shared components → Galleries/Shared/
echo "Moving gallery shared components → Galleries/Shared/..."
git mv src/components/Campaign/ImageCarousel.tsx         src/components/Galleries/Shared/
git mv src/components/Campaign/ImageCarousel.test.tsx    src/components/Galleries/Shared/
git mv src/components/Campaign/VideoCarousel.tsx         src/components/Galleries/Shared/
git mv src/components/Campaign/VideoCarousel.test.tsx    src/components/Galleries/Shared/
git mv src/components/Campaign/OverlayArrows.tsx         src/components/Galleries/Shared/
git mv src/components/Campaign/OverlayArrows.test.tsx    src/components/Galleries/Shared/
git mv src/components/Campaign/DotNavigator.tsx          src/components/Galleries/Shared/
git mv src/components/Campaign/DotNavigator.test.tsx     src/components/Galleries/Shared/
git mv src/components/Campaign/Lightbox.tsx              src/components/Galleries/Shared/
git mv src/components/Campaign/Lightbox.test.tsx         src/components/Galleries/Shared/
git mv src/components/Campaign/KeyboardHintOverlay.tsx   src/components/Galleries/Shared/

# 5. Move gallery-adapters/ → Galleries/Adapters/
echo "Moving gallery-adapters/ → Galleries/Adapters/..."
git mv src/gallery-adapters/GalleryAdapter.ts            src/components/Galleries/Adapters/
git mv src/gallery-adapters/adapterRegistry.ts           src/components/Galleries/Adapters/
git mv src/gallery-adapters/_shared                      src/components/Galleries/Adapters/
git mv src/gallery-adapters/__tests__                    src/components/Galleries/Adapters/
git mv src/gallery-adapters/compact-grid                 src/components/Galleries/Adapters/
git mv src/gallery-adapters/justified                    src/components/Galleries/Adapters/
git mv src/gallery-adapters/masonry                      src/components/Galleries/Adapters/
git mv src/gallery-adapters/hexagonal                    src/components/Galleries/Adapters/
git mv src/gallery-adapters/circular                     src/components/Galleries/Adapters/
git mv src/gallery-adapters/diamond                      src/components/Galleries/Adapters/
git mv src/gallery-adapters/layout-builder               src/components/Galleries/Adapters/

# 6. Move shared/ → Common/
echo "Moving shared/ → Common/..."
git mv src/components/shared/CompanyLogo.tsx             src/components/Common/
git mv src/components/shared/InContextEditor.tsx         src/components/Common/
git mv src/components/shared/TypographyEditor.tsx        src/components/Common/
git mv src/components/shared/GradientEditor.tsx          src/components/Common/
git mv src/components/shared/ConfirmModal.tsx            src/components/Common/
git mv src/components/shared/CampaignSelector.tsx        src/components/Common/
git mv src/components/shared/UnifiedCampaignModal.tsx    src/components/Campaign/
git mv src/components/shared/UnifiedCampaignModal.test.tsx src/components/Campaign/

# 7. Clean up empty directories
echo "Cleaning up empty directories..."
rmdir src/components/Gallery 2>/dev/null || true
rmdir src/components/shared 2>/dev/null || true
rmdir src/gallery-adapters 2>/dev/null || true

echo ""
echo "=== File moves complete! ==="
echo "Next: Import path updates will be applied by the automated tool."
echo ""
