import { CardGallery } from './components/Gallery/CardGallery';
import { mockCampaigns, mockUserPermissions } from './data/mockData';

function App() {
  return (
    <CardGallery
      campaigns={mockCampaigns}
      userPermissions={mockUserPermissions}
    />
  );
}

export default App;
