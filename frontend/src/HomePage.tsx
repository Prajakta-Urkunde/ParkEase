import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";
import { useAuth } from "./context/AuthContext";

const images = {
  hero: "/images/hero-parking.jpg",

  solution1: "/images/parking-1.jpg",
  solution2: "/images/parking-2.jpg",
  solution3: "/images/parking-3.jpg",
  solution4: "/images/parking-4.jpg",
  solution5: "/images/parking-5.jpg",

  service1: "/images/service-1.jpg",
  service2: "/images/service-2.jpg",
  service3: "/images/service-3.jpg",

  city: "/images/city-parking.jpg",
};

const solutions = [
  {
    title: "Smart Parking",
    text: "Find available parking spaces quickly and easily.",
    image: images.solution1,
    large: true,
  },
  {
    title: "Parking Reservations",
    text: "Reserve your parking slot before you arrive.",
    image: images.solution2,
  },
  {
    title: "Real-Time Availability",
    text: "See parking availability in real time.",
    image: images.solution3,
  },
  {
    title: "GPS Navigation",
    text: "Navigate directly to your selected parking location.",
    image: images.solution4,
  },
  {
    title: "Digital Parking",
    text: "Manage your entire parking experience digitally.",
    image: images.solution5,
  },
  {
    title: "Parking Management",
    text: "Powerful tools for parking owners and operators.",
    image: images.service1,
  },
];

const services = [
  {
    number: "01",
    title: "Smart Parking & AI",
    description:
      "Use intelligent parking technology to monitor availability, manage spaces and improve the customer experience.",
    image: images.service1,
  },
  {
    number: "02",
    title: "Parking Operations",
    description:
      "Manage parking lots, parking slots, reservations and users from one centralized platform.",
    image: images.service2,
  },
  {
    number: "03",
    title: "Parking Consultancy",
    description:
      "Use parking data and insights to improve utilization, capacity and operational efficiency.",
    image: images.service3,
  },
];

const advantages = [
  {
    number: "01",
    title: "Real-Time Data",
    text: "Know exactly which parking spaces are available.",
  },
  {
    number: "02",
    title: "Simple Experience",
    text: "Search, reserve and navigate with minimum effort.",
  },
  {
    number: "03",
    title: "Complete Management",
    text: "Owners get powerful tools to manage parking operations.",
  },
];

const testimonials = [
  {
    quote:
      "ParkEase makes finding and reserving parking much easier. The real-time availability saves a lot of time.",
    name: "Parking User",
    role: "ParkEase Customer",
  },
  {
    quote:
      "Managing parking spaces becomes much simpler when everything is available from one dashboard.",
    name: "Parking Owner",
    role: "ParkEase Partner",
  },
  {
    quote:
      "The combination of maps, reservations and parking management gives us a much better workflow.",
    name: "Operations Manager",
    role: "Parking Operations",
  },
];

const insights = [
  {
    category: "PARKING",
    title: "The Future of Smart Parking",
    text: "How digital parking technology is changing the way people find and use parking.",
    image: images.city,
  },
  {
    category: "TECHNOLOGY",
    title: "How Real-Time Availability Works",
    text: "Understanding how parking availability can be managed digitally.",
    image: images.solution3,
  },
  {
    category: "MOBILITY",
    title: "Better Parking, Better Cities",
    text: "Why efficient parking management can improve the urban mobility experience.",
    image: images.solution4,
  },
];

const faqs = [
  {
    question: "How does ParkEase work?",
    answer:
      "ParkEase allows users to search for parking locations, check available slots, reserve a slot and navigate to the parking location.",
  },
  {
    question: "Can I reserve a parking slot?",
    answer:
      "Yes. Users can select a parking location, view its available slots and reserve an available slot.",
  },
  {
    question: "Can parking owners manage their parking lots?",
    answer:
      "Yes. Owners can create parking lots, add parking slots, monitor availability and view reservation activity.",
  },
  {
    question: "Does ParkEase provide GPS navigation?",
    answer:
      "Yes. ParkEase can use your location and provide navigation to the selected parking location.",
  },
  {
    question: "Can I see my previous reservations?",
    answer:
      "Yes. Your reservation history is available from the user dashboard.",
  },
];

function ScrollReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`reveal-item ${className}`}>
      {children}
    </div>
  );
}

function AnimatedStat({
  value,
  suffix = "",
  label,
}: {
  value: number;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    let frame = 0;
    const duration = 1600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const progress = Math.min(
        (currentTime - startTime) / duration,
        1
      );

      const eased = 1 - Math.pow(1 - progress, 3);

      setCount(Math.floor(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [started, value]);

  return (
    <div className="stat-item" ref={ref}>
      <div className="stat-number">
        {count.toLocaleString("en-IN")}
        {suffix}
      </div>

      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  useEffect(() => {
    const elements = document.querySelectorAll(".reveal-item");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.12,
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTestimonialIndex((current) => {
        return (current + 1) % testimonials.length;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const goToLogin = () => {
    navigate(
      user?.role === "admin" ? "/admin-dashboard" :
      user?.role === "owner" ? "/owner-dashboard" :
        user ? "/user-dashboard" : "/login"
    );
  };

  const currentTestimonial = testimonials[testimonialIndex];

  return (
    <main className="home-page">
      {/* HEADER */}

      <header className="home-header">
        <div className="home-nav">
          <a href="#home" className="brand">
            <span className="brand-mark">P</span>

            <span className="brand-text">
              Park<span>Ease</span>
            </span>
          </a>

          <nav className="desktop-nav">
            <div className="nav-dropdown">
              <a href="#solutions">
                SOLUTIONS
                <span>⌄</span>
              </a>

              <div className="dropdown-menu">
                <a href="#solutions">Smart Parking</a>
                <a href="#solutions">Reservations</a>
                <a href="#solutions">GPS Navigation</a>
                <a href="#services">Parking Management</a>
              </div>
            </div>

            <div className="nav-dropdown">
              <a href="#company">
                COMPANY
                <span>⌄</span>
              </a>

              <div className="dropdown-menu">
                <a href="#company">About ParkEase</a>
                <a href="#advantages">Our Advantages</a>
                <a href="#stats">Our Impact</a>
              </div>
            </div>

            <a href="#services">SERVICES</a>

            <a href="#insights">MEDIA</a>
          </nav>

          <div className="header-actions">
            {user?.role === "admin" && (
              <button
                type="button"
                className="admin-dashboard-nav-link"
                onClick={() => navigate("/admin-dashboard")}
              >
                ADMIN DASHBOARD
              </button>
            )}

            <button
              type="button"
              className={`mobile-menu-button ${
                mobileMenuOpen ? "active" : ""
              }`}
              onClick={() =>
                setMobileMenuOpen(!mobileMenuOpen)
              }
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <span />
              <span />
              <span />
            </button>

            <a href="#contact" className="contact-link">
              CONTACT
            </a>

            <button
              type="button"
              className="header-cta"
              onClick={goToLogin}
            >
              FIND PARKING
              <span>↗</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-menu" id="mobile-navigation">
            {user?.role === "admin" && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/admin-dashboard");
                }}
              >
                ADMIN DASHBOARD
              </button>
            )}

            <a
              href="#solutions"
              onClick={() => setMobileMenuOpen(false)}
            >
              SOLUTIONS
            </a>

            <a
              href="#services"
              onClick={() => setMobileMenuOpen(false)}
            >
              SERVICES
            </a>

            <a
              href="#advantages"
              onClick={() => setMobileMenuOpen(false)}
            >
              WHY PARKEASE
            </a>

            <a
              href="#insights"
              onClick={() => setMobileMenuOpen(false)}
            >
              INSIGHTS
            </a>

            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
            >
              CONTACT
            </a>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                goToLogin();
              }}
            >
              FIND PARKING
              <span>↗</span>
            </button>
          </div>
        )}
      </header>

      {/* HERO */}

      <section
        className="hero"
        id="home"
        style={
          {
            "--hero-image": `url("${images.hero}")`,
          } as CSSProperties
        }
      >
        <div className="hero-overlay" />

        <div className="hero-content">
          <ScrollReveal>
            <div className="hero-pill">SMART PARKING • INDIA</div>
          </ScrollReveal>

          <ScrollReveal>
            <h1>
              Parking made
              <br />
              <span>simple.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal>
            <p>
              Find. Reserve. Navigate.
              <br />
              Your complete parking experience in one place.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <button
              className="hero-button"
              onClick={goToLogin}
            >
              FIND PARKING
              <span>→</span>
            </button>
          </ScrollReveal>
        </div>

        <div className="hero-scroll">
          <span>SCROLL TO EXPLORE</span>
          <span className="scroll-line" />
        </div>
      </section>

      {/* TICKER */}

      <div className="ticker">
        <div className="ticker-track">
          <span>SMART PARKING</span>
          <i>✦</i>
          <span>REAL-TIME AVAILABILITY</span>
          <i>✦</i>
          <span>PARKING RESERVATIONS</span>
          <i>✦</i>
          <span>GPS NAVIGATION</span>
          <i>✦</i>
          <span>PARKING MANAGEMENT</span>
          <i>✦</i>

          <span>SMART PARKING</span>
          <i>✦</i>
          <span>REAL-TIME AVAILABILITY</span>
          <i>✦</i>
          <span>PARKING RESERVATIONS</span>
          <i>✦</i>
          <span>GPS NAVIGATION</span>
          <i>✦</i>
        </div>
      </div>

      {/* SOLUTIONS */}

      <section className="section solutions-section" id="solutions">
        <div className="section-heading reveal-item">
          <div>
            <span className="eyebrow">WHAT WE DO</span>

            <h2>
              All your parking
              <br />
              needs.
            </h2>
          </div>

          <p>
            ParkEase brings parking discovery, reservations,
            navigation and management together in one
            intelligent platform.
          </p>
        </div>

        <div className="solutions-grid">
          {solutions.map((solution, index) => (
            <ScrollReveal
              key={solution.title}
              className={`solution-card ${
                solution.large ? "solution-large" : ""
              }`}
            >
              <div
                className="solution-image"
                style={
                  {
                    "--card-image": `url("${solution.image}")`,
                    "--delay": `${index * 70}ms`,
                  } as CSSProperties
                }
              />

              <div className="solution-overlay" />

              <div className="solution-content">
                <span className="solution-number">
                  0{index + 1}
                </span>

                <div>
                  <h3>{solution.title}</h3>

                  <p>{solution.text}</p>

                  <span className="explore-link">
                    EXPLORE <b>↗</b>
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* STATS */}

      <section className="stats-section" id="stats">
        <div className="stats-background" />

        <div className="stats-inner">
          <ScrollReveal>
            <span className="eyebrow light">
              PARKING BY THE NUMBERS
            </span>

            <h2>
              Built to make
              <br />
              parking <em>better.</em>
            </h2>
          </ScrollReveal>

          <div className="stats-grid">
            <AnimatedStat
              value={100}
              suffix="+"
              label="Parking Locations"
            />

            <AnimatedStat
              value={10000}
              suffix="+"
              label="Parking Slots"
            />

            <AnimatedStat
              value={50000}
              suffix="+"
              label="Reservations"
            />

            <AnimatedStat
              value={99}
              suffix="%"
              label="Digital Experience"
            />
          </div>
        </div>
      </section>

      {/* SERVICES */}

      <section className="section services-section" id="services">
        <div className="section-heading reveal-item">
          <div>
            <span className="eyebrow">OUR SERVICES</span>

            <h2>
              One platform.
              <br />
              Every parking need.
            </h2>
          </div>

          <p>
            From individual parking users to parking owners,
            ParkEase provides tools for the complete parking
            journey.
          </p>
        </div>

        <div className="service-panels">
          {services.map((service) => (
            <div
              className="service-panel"
              key={service.number}
              style={
                {
                  "--service-image": `url("${service.image}")`,
                } as CSSProperties
              }
            >
              <div className="service-panel-overlay" />

              <div className="service-number">
                {service.number}
              </div>

              <div className="service-content">
                <h3>{service.title}</h3>

                <p>{service.description}</p>

                <button>
                  LEARN MORE
                  <span>↗</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ADVANTAGES */}

      <section
        className="section advantages-section"
        id="advantages"
      >
        <div className="advantages-layout">
          <ScrollReveal className="advantages-intro">
            <span className="eyebrow">WHY PARKEASE</span>

            <h2>
              Parking
              <br />
              <em>without</em>
              <br />
              the stress.
            </h2>

            <p>
              Designed around the real needs of drivers,
              parking owners and modern cities.
            </p>

            <button
              className="dark-button"
              onClick={goToLogin}
            >
              GET STARTED
              <span>→</span>
            </button>
          </ScrollReveal>

          <div className="advantages-list">
            {advantages.map((item) => (
              <ScrollReveal
                key={item.number}
                className="advantage-item"
              >
                <span className="advantage-number">
                  {item.number}
                </span>

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>

                <span className="advantage-arrow">↗</span>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* LOGO / PARTNER MARQUEE */}

      <section className="partner-section">
        <div className="partner-label">
          TRUSTED PARKING TECHNOLOGY
        </div>

        <div className="partner-marquee">
          <div className="partner-track">
            <span>SMART CITY</span>
            <span>URBAN MOBILITY</span>
            <span>TECH PARKS</span>
            <span>RETAIL PARKING</span>
            <span>COMMERCIAL PARKING</span>

            <span>SMART CITY</span>
            <span>URBAN MOBILITY</span>
            <span>TECH PARKS</span>
            <span>RETAIL PARKING</span>
            <span>COMMERCIAL PARKING</span>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}

      <section className="testimonial-section">
        <div className="testimonial-inner">
          <ScrollReveal>
            <span className="eyebrow light">
              CUSTOMER STORIES
            </span>

            <div className="quote-mark">“</div>

            <blockquote>
              {currentTestimonial.quote}
            </blockquote>

            <div className="testimonial-person">
              <strong>{currentTestimonial.name}</strong>
              <span>{currentTestimonial.role}</span>
            </div>

            <div className="testimonial-controls">
              <button
                onClick={() =>
                  setTestimonialIndex(
                    (testimonialIndex -
                      1 +
                      testimonials.length) %
                      testimonials.length
                  )
                }
              >
                ←
              </button>

              <span>
                {String(testimonialIndex + 1).padStart(2, "0")}
                {" / "}
                {String(testimonials.length).padStart(2, "0")}
              </span>

              <button
                onClick={() =>
                  setTestimonialIndex(
                    (testimonialIndex + 1) %
                      testimonials.length
                  )
                }
              >
                →
              </button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* INSIGHTS */}

      <section className="section insights-section" id="insights">
        <div className="section-heading reveal-item">
          <div>
            <span className="eyebrow">INSIGHTS</span>

            <h2>
              Parking.
              <br />
              Reimagined.
            </h2>
          </div>

          <p>
            Explore ideas and insights about smart parking,
            mobility and parking technology.
          </p>
        </div>

        <div className="insights-grid">
          {insights.map((insight, index) => (
            <ScrollReveal
              key={insight.title}
              className="insight-card"
            >
              <div
                className="insight-image"
                style={
                  {
                    backgroundImage: `url("${insight.image}")`,
                    "--delay": `${index * 80}ms`,
                  } as CSSProperties
                }
              />

              <div className="insight-content">
                <span>{insight.category}</span>

                <h3>{insight.title}</h3>

                <p>{insight.text}</p>

                <button>
                  READ MORE
                  <span>↗</span>
                </button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* FAQ */}

      <section className="section faq-section">
        <div className="faq-layout">
          <ScrollReveal className="faq-intro">
            <span className="eyebrow">FAQ</span>

            <h2>
              Frequently
              <br />
              asked
              <br />
              <em>questions.</em>
            </h2>

            <p>
              Everything you need to know about using
              ParkEase.
            </p>
          </ScrollReveal>

          <div className="faq-list">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;

              return (
                <div
                  className={`faq-item ${
                    isOpen ? "open" : ""
                  }`}
                  key={faq.question}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() =>
                      setActiveFaq(
                        isOpen ? null : index
                      )
                    }
                  >
                    <span>{faq.question}</span>

                    <span className="faq-icon">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  <div className="faq-answer" id={`faq-answer-${index}`}>
                    <p>{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}

      <section className="final-cta" id="contact">
        <div className="final-cta-overlay" />

        <div className="final-cta-content">
          <span className="eyebrow light">
            READY TO PARK SMARTER?
          </span>

          <h2>
            Your next parking
            <br />
            spot is waiting.
          </h2>

          <button
            className="hero-button"
            onClick={goToLogin}
          >
            FIND PARKING
            <span>→</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="home-footer" id="company">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="#home" className="brand footer-logo">
              <span className="brand-mark">P</span>

              <span className="brand-text">
                Park<span>Ease</span>
              </span>
            </a>

            <p>
              A smarter way to find, reserve and manage
              parking.
            </p>
          </div>

          <div className="footer-column">
            <h4>SOLUTIONS</h4>

            <a href="#solutions">Smart Parking</a>
            <a href="#solutions">Reservations</a>
            <a href="#solutions">GPS Navigation</a>
            <a href="#solutions">Real-Time Availability</a>
          </div>

          <div className="footer-column">
            <h4>COMPANY</h4>

            <a href="#company">About</a>
            <a href="#advantages">Why ParkEase</a>
            <a href="#stats">Our Impact</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="footer-column">
            <h4>ACCOUNT</h4>

            <button onClick={goToLogin}>Login</button>
            <button onClick={() => navigate("/register")}>
              Create Account
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2026 ParkEase. All rights reserved.
          </span>

          <span>SMART PARKING • BETTER MOBILITY</span>
        </div>
      </footer>
    </main>
  );
}
