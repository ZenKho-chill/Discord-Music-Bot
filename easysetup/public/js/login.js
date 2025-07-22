document.querySelectorAll('.pin-input').forEach(input => {
  input.addEventListener('input', (e) => {
    const value = e.target.value;
    const index = parseInt(e.target.dataset.index);

    if (value) {
      // Move to next input
      if (index < 3) {
        document.querySelector(`[data-index="${index + 1}"]`).focus();
      }
    }

    // Enable/disable connect button
    const allInputs = document.querySelectorAll('.pin-input');
    const pin = Array.from(allInputs).map(input => input.value).join('');
    document.querySelector('.btn-connect').disabled = pin.length !== 4;
  });

  input.addEventListener('keydown', (e) => {
    const index = parseInt(e.target.dataset.index);

    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      // Move to previous input on backspace if current is empty
      document.querySelector(`[data-index="${index - 1}"]`).focus();
    }
  });
});

document.querySelector('.btn-connect').addEventListener('click', async () => {
  const pin = Array.from(document.querySelectorAll('.pin-input'))
    .map(input => input.value)
    .join('');

  try {
    const response = await fetch('/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin })
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = '/setup/discord';
    } else {
      alert(data.message || 'Mã PIN không đúng');
      // Reset inputs
      document.querySelectorAll('.pin-input').forEach(input => input.value = '');
      document.querySelector('[data-index="0"]').focus();
    }
  } catch (error) {
    console.error('Lỗi:', error);
    alert('Có lỗi xảy ra khi xác thực');
  }
});
