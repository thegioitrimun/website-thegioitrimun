import React from 'react';
import JackPortfolio from './jack/JackPortfolio';

interface AboutPageProps {
  onBack?: () => void;
  onGoToServices?: () => void;
  onGoToBlog?: () => void;
  onRequestBooking?: () => void;
  aboutData?: any;
  doctors?: any[];
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return <JackPortfolio onBackToClinic={onBack} />;
};

export default AboutPage;
