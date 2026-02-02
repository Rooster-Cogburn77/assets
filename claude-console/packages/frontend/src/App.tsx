import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useSessionsStore } from '@/store/sessions';

function App() {
  const { connect, loadSessions } = useSessionsStore();

  useEffect(() => {
    const init = async () => {
      try {
        await connect();
        await loadSessions();
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    init();
  }, [connect, loadSessions]);

  return <Layout />;
}

export default App;
