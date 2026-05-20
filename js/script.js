const bar = document.getElementsById('bar');
const nav = document.gatElementById('navbar');

if (bar){
    bar.addEventListener('click', () => {
        nav.classList.add('active');

    })
}