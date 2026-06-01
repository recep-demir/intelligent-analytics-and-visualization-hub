import { useState } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  const [userRole, setUserRole] = useState<'Admin' | 'Restricted'>('Admin');
  const [question, setQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chartTitle, setChartTitle] = useState<string>('');
  const [chartType, setChartType] = useState<string>('');
  const [chartData, setChartData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  const handleSearch = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setErrorMessage('');
    setChartData(null);

    setTimeout(() => {
      // US-03: Restricted access check (Updated keywords and message to English)
      if (userRole === 'Restricted' && (question.toLowerCase().includes('salary') || question.toLowerCase().includes('revenue'))) {
        setErrorMessage('Access Denied: You are not authorized to view this data. Please contact your system administrator.');
        setIsLoading(false);
        return;
      }

      // US-01: Friendly error for unrecognizable questions
      if (question.length < 5) {
        setErrorMessage(
          'Sorry, I couldn\'t understand that question. Please try a different query, such as "Revenue by category" or "Orders over time."'
        );
        setIsLoading(false);
        return;
      }

      // US-02: Automatic chart type selection based on English keywords
      let detectedType = 'bar'; // Default comparison -> Bar chart
      let labels = ['January', 'February', 'March', 'April'];
      let dataValues = [12, 19, 3, 5];

      if (question.toLowerCase().includes('time') || question.toLowerCase().includes('monthly') || question.toLowerCase().includes('trend')) {
        detectedType = 'line'; // Time-based -> Line chart
      } else if (question.toLowerCase().includes('proportion') || question.toLowerCase().includes('region') || question.toLowerCase().includes('share')) {
        detectedType = 'pie';  // Proportions / Regions -> Pie chart
      }

      // US-01: Chart title reflects the question asked
      setChartTitle(`Result for: "${question}"`); 
      setChartType(detectedType);
      setChartData({
        labels: labels,
        datasets: [
          {
            label: 'Elio Tax Sandbox Signals',
            data: dataValues,
            backgroundColor: detectedType === 'pie' 
              ? ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'] 
              : '#0070f3',
            borderColor: '#0070f3',
            borderWidth: 1,
          },
        ],
      });
      setIsLoading(false);
    }, 1500);
  };

  return (
    // US-04: Desktop responsive layout with no content cut off
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'sans-serif', margin: 0 }}>
      
      {/* LEFT PANEL: Chat & Profile Control */}
      <div style={{ width: '30%', borderRight: '1px solid #ccc', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#f9f9f9' }}>
        <div>
          <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>Elio Tax AI Assistant</h3>
          <hr style={{ border: '0', borderTop: '1px solid #ddd' }} />
          
          {/* Mock Auth Role Selector for US-03 Testing */}
          <div style={{ margin: '15px 0', padding: '10px', background: '#eee', borderRadius: '5px' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}><strong>User Role (Mock Auth):</strong></p>
            <button onClick={() => { setUserRole('Admin'); setErrorMessage(''); }} style={{ marginRight: '5px', cursor: 'pointer', padding: '4px 8px' }}>Admin</button>
            <button onClick={() => { setUserRole('Restricted'); setErrorMessage(''); }} style={{ cursor: 'pointer', padding: '4px 8px' }}>Restricted User</button>
            <p style={{ fontSize: '11px', marginTop: '8px', color: '#666', marginBottom: 0 }}>Active Role: <strong style={{ color: userRole === 'Admin' ? 'green' : 'red' }}>{userRole}</strong></p>
          </div>
        </div>

        {/* Question Input Section */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <input 
            type="text" 
            placeholder='e.g., Show monthly trends...' 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
          />
          <button 
            onClick={handleSearch} 
            disabled={isLoading}
            style={{ padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isLoading ? 'Analyzing...' : 'Ask Assistant'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Dynamic Chart Display Area */}
      <div style={{ width: '70%', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        
        {/* Status 1: Loading */}
        {isLoading && <div style={{ fontSize: '18px', color: '#666' }}>AI is rendering your visualization within 10s...</div>}

        {/* Status 2: Error and Authorization Messages (US-01 & US-03) */}
        {!isLoading && errorMessage && (
          <div style={{ padding: '20px', backgroundColor: '#fff3f3', color: '#d32f2f', borderRadius: '8px', border: '1px solid #fdadad', maxWidth: '500px', textAlign: 'center' }}>
            <strong>⚠️ Notice:</strong> {errorMessage}
          </div>
        )}

        {/* Status 3: Successful Responsive Chart Rendering (US-01, US-02, US-04) */}
        {!isLoading && !errorMessage && chartData && (
          <div style={{ width: '100%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ marginBottom: '20px', color: '#333', textAlign: 'center' }}>{chartTitle}</h2>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {chartType === 'line' && <Line data={chartData} options={chartOptions} />}
              {chartType === 'bar' && <Bar data={chartData} options={chartOptions} />}
              {chartType === 'pie' && <Pie data={chartData} options={chartOptions} />}
            </div>
          </div>
        )}

        {/* Status 4: Welcome / Default Empty Screen */}
        {!isLoading && !errorMessage && !chartData && (
          <div style={{ color: '#999', textAlign: 'center' }}>
            <p style={{ fontSize: '26px', margin: '0 0 10px 0' }}>📊 Intelligent Analytics Hub</p>
            <p style={{ fontSize: '14px' }}>Explore operational and commercial signals using natural language queries.</p>
          </div>
        )}

      </div>
    </div>
  );
}
