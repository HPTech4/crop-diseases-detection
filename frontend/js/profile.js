const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!localStorage.getItem('token')) {
  window.location.href = './login.html';
} else {
  const name = user?.name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || 'No email available';
  document.getElementById('userName').textContent = name;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = email;
  document.getElementById('displayName').value = name;
  document.getElementById('emailAddress').value = email;
  document.getElementById('profileAvatar').textContent = name.charAt(0).toUpperCase();
}

document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
const themeSelect = document.getElementById('themeSelect');
themeSelect.value = localStorage.getItem('theme') || 'light';
themeSelect.addEventListener('change', () => {
  document.documentElement.setAttribute('data-theme', themeSelect.value);
  localStorage.setItem('theme', themeSelect.value);
});
document.getElementById('themeToggle').addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeSelect.value = theme;
  localStorage.setItem('theme', theme);
});
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('profileLogout').addEventListener('click', logout);
