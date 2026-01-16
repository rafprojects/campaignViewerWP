import { CardGallery } from './components/Gallery/CardGallery';
import { mockCampaigns, mockUserPermissions } from './data/mockData';

function App() {
  return (
    <div className="wp-super-gallery">
      <CardGallery
        campaigns={mockCampaigns}
        userPermissions={mockUserPermissions}
      />
    </div>
  );
}

export default App;
