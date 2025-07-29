import './App.css';
import Excel from './components/Excel/index.tsx';

const App = () => {
  return (
    <div className="content" style={{ height: '100vh' }}>
      <Excel
        url="/example1.xlsx"
        onInitLoad={() => {
          console.log('onInitLoad');
        }}
        onError={(err) => {
          console.log('onError', err);
        }}
        LoadingComponent={({ message }) => (
          <div>
            <p style={{ color: 'blue' }}>{message}</p>
          </div>
        )}
      />
    </div>
  );
};

export default App;
