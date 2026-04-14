document.addEventListener('DOMContentLoaded', () => {

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Intersection Observer for scroll reveal animations
    const revealElements = document.querySelectorAll('.scroll-reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Stop observing once revealed
            }
        });
    }, {
        root: null,
        threshold: 0.15, // Trigger when 15% of the element is visible
        rootMargin: "0px 0px -50px 0px"
    });

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // Smooth scrolling for anchor links to enhance the parallax feel
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Determine offset for navbar
                const offset = 80;
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = targetElement.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // FormSubmit AJAX Handler for Emailing
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button');
            const originalText = btn.textContent;
            
            btn.textContent = "Sending...";
            btn.style.opacity = "0.8";
            
            const formData = new FormData(contactForm);
            
            fetch("https://formsubmit.co/ajax/northgateandco@gmail.com", {
                method: "POST",
                headers: { 
                    'Accept': 'application/json'
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                btn.textContent = "Message Sent!";
                btn.style.background = "#28a745";
                btn.style.boxShadow = "0 4px 15px rgba(40, 167, 69, 0.4)";
                contactForm.reset();
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = "";
                    btn.style.boxShadow = "";
                    btn.style.opacity = "1";
                }, 3000);
            })
            .catch(error => {
                btn.textContent = "Error! Try Again.";
                btn.style.background = "#dc3545";
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = "";
                    btn.style.opacity = "1";
                }, 3000);
            });
        });
    }

    // Advanced Parallax Effects
    const parallaxBgs = document.querySelectorAll('.parallax-bg');
    const glassPanels = document.querySelectorAll('.glass-panel');

    // 1. Scroll-based background parallax
    window.addEventListener('scroll', () => {
        let scrollY = window.scrollY;
        
        parallaxBgs.forEach(bg => {
            const parent = bg.parentElement;
            const parentTop = parent.offsetTop;
            const parentHeight = parent.offsetHeight;
            
            // Only animate if section is in viewport
            if (scrollY + window.innerHeight > parentTop && scrollY < parentTop + parentHeight) {
                // Determine how far through the block we've scrolled
                const scrollPos = scrollY - parentTop;
                // Move the background down half the speed of the scroll
                const yPos = scrollPos * 0.4;
                bg.style.transform = `translateY(${yPos}px) scale(1.05)`;
            }
        });
    });

    // 2. Mouse-move 3D Tilt Parallax on Glass Panels
    if (window.innerWidth > 768) {
        glassPanels.forEach(panel => {
            panel.addEventListener('mousemove', (e) => {
                const rect = panel.getBoundingClientRect();
                const x = e.clientX - rect.left; // Position within element
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const percentX = (x - centerX) / centerX; // -1 to 1
                const percentY = -((y - centerY) / centerY); // 1 to -1

                // Max rotation 5 deg
                const rotateX = percentY * 5;
                const rotateY = percentX * 5;

                panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                panel.style.transition = 'none'; // remove transition for smooth follow
            });

            panel.addEventListener('mouseleave', () => {
                panel.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                panel.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
            });
            
            panel.addEventListener('mouseenter', () => {
                panel.style.transition = 'transform 0.1s ease';
            });
        });
    }
});
