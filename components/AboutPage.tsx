import React from 'react';
import AboutLandingPage from './about-landing/AboutLandingPage';

interface AboutPageProps {
  onBack?: () => void;
  onGoToServices?: () => void;
  onGoToBlog?: () => void;
  onRequestBooking?: () => void;
  aboutData?: any;
  doctors?: any[];
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return <AboutLandingPage onBackToClinic={onBack} />;
};

export default AboutPage;
