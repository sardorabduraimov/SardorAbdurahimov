document.querySelector('.form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  alert("Rahmat! Arizangiz qabul qilindi. Tez orada bog'lanamiz.");
  e.target.reset();
});
