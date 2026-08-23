import auth from './auth.js';
import { API_URL, showToast, formatDate } from './utils.js';

class Dashboard {
  constructor() {
    this.user = auth.getUser();
    this.setupUI();
    this.setupEventListeners();
  }

  setupUI() {
    // Set user name
    const welcomeName = document.getElementById('welcomeName');
    const userName = document.getElementById('userName');
    const name = this.user?.name || 'User';
    if (welcomeName) welcomeName.textContent = name;
    if (userName) userName.textContent = name;
  }

  setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      auth.logout();
    });

    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const newTheme = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });

    // Restore theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  async load() {
    try {
      await this.loadStats();
      await this.loadRecentScans();
      await this.loadChart();
      await this.loadDiseases();
    } catch (error) {
      console.error('Dashboard load error:', error);
      showToast('Error loading dashboard', 'error');
    }
  }

  async loadStats() {
    try {
      const response = await fetch(`${API_URL}/scans/stats/dashboard`, {
        headers: auth.getHeaders()
      });

      const data = await response.json();

      if (data.success) {
        const stats = data.data;
        document.getElementById('totalScans').textContent = stats.totalScans || 0;
        document.getElementById('healthyScans').textContent = stats.healthyScans || 0;
        document.getElementById('diseasedScans').textContent = stats.diseasedScans || 0;
        document.getElementById('successRate').textContent = stats.healthyRate || '0%';
      }
    } catch (error) {
      console.error('Stats load error:', error);
    }
  }

  async loadRecentScans() {
    try {
      const response = await fetch(`${API_URL}/scans?limit=6`, {
        headers: auth.getHeaders()
      });

      const data = await response.json();

      const container = document.getElementById('recentScansContainer');
      if (!container) return;

      if (!data.success || data.data.length === 0) {
        container.innerHTML = `
          <p class="no-data">No scans yet. <a href="upload.html">Upload your first image!</a></p>
        `;
        return;
      }

      container.innerHTML = data.data.map(scan => `
        <div class="scan-card">
          <img src="${scan.image_url || '../assets/images/default-plant.jpg'}" alt="${scan.plant_name || 'Plant'}" />
          <div class="scan-info">
            <h4>${scan.plant_name || 'Unknown Plant'}</h4>
            <span class="status ${scan.health_status === 'healthy' ? 'healthy' : 'diseased'}">
              ${scan.health_status === 'healthy' ? '✅ Healthy' : '⚠️ Diseased'}
            </span>
            <div class="date">${formatDate(scan.created_at)}</div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Recent scans error:', error);
    }
  }

  async loadChart() {
    try {
      const response = await fetch(`${API_URL}/scans/stats/dashboard`, {
        headers: auth.getHeaders()
      });

      const data = await response.json();

      if (!data.success || !data.data.last7Days) {
        return;
      }

      const ctx = document.getElementById('activityChart');
      if (!ctx) return;

      const chartData = data.data.last7Days;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.map(d => d.date),
          datasets: [{
            label: 'Scans',
            data: chartData.map(d => d.count),
            backgroundColor: '#4CAF50',
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    } catch (error) {
      console.error('Chart load error:', error);
    }
  }

  async loadDiseases() {
    try {
      const response = await fetch(`${API_URL}/scans/stats/dashboard`, {
        headers: auth.getHeaders()
      });

      const data = await response.json();

      const container = document.getElementById('commonDiseases');
      if (!container) return;

      if (!data.success || !data.data.commonDiseases || data.data.commonDiseases.length === 0) {
        container.innerHTML = '<p class="no-data">No diseases detected yet</p>';
        return;
      }

      const maxCount = Math.max(...data.data.commonDiseases.map(d => d.count));

      container.innerHTML = data.data.commonDiseases.map(d => `
        <div class="disease-item">
          <span class="disease-name">${d.name}</span>
          <div class="disease-bar">
            <div class="disease-fill" style="width: ${(d.count / maxCount) * 100}%"></div>
          </div>
          <span class="disease-count">${d.count} scans</span>
        </div>
      `).join('');
    } catch (error) {
      console.error('Diseases load error:', error);
    }
  }
}

export default Dashboard;
