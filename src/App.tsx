import './App.css';
import Excel from './components/Excel/index.tsx';

const App = () => {
  return (
    <div className="content" style={{ height: '100vh' }}>
      <Excel
        // url="/example3.csv"
        url="/fc2769bc4f0645609b95b6130f9eb4d3.xlsx"
        // url="/144aebd642334e1397e9f7f550e13c5c.xlsx"
        // url="/2w_rows.xlsx"
        // url="https://pan.shinemo.com/remote.php/webdav/%E4%B8%80%E4%BD%93%E6%9C%BA%E7%89%88%E6%9C%AC%E5%BC%80%E5%8F%91%E8%AE%A1%E5%88%92.xlsx"
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
