import React from 'react';
import { FadeIn } from './FadeIn';
import type { ServiceItem } from './types';

const SERVICES: ServiceItem[] = [
  {
    id: '01',
    number: '01',
    name: 'Điều trị mụn chuyên sâu',
    description:
      'Phác đồ điều trị mụn cá nhân hóa kết hợp công nghệ hiện đại và dược mỹ phẩm chuyên dụng.',
  },
  {
    id: '02',
    number: '02',
    name: 'Peel da hóa học',
    description:
      'Tái tạo bề mặt da bằng các loại acid chuyên dụng, cải thiện sắc tố, mụn và lão hóa.',
  },
  {
    id: '03',
    number: '03',
    name: 'Vi kim RF tái tạo da',
    description:
      'Công nghệ vi kim kết hợp sóng cao tần (RF) kích thích collagen, điều trị sẹo rỗ và trẻ hóa da.',
  },
  {
    id: '04',
    number: '04',
    name: 'Laser trẻ hóa da',
    description:
      'Công nghệ laser phân đoạn (Fractional CO2/Er:YAG) tái tạo da toàn diện, xóa nếp nhăn và trẻ hóa.',
  },
  {
    id: '05',
    number: '05',
    name: 'Tiêm dưỡng chất Mesotherapy',
    description:
      'Tiêm trực tiếp vitamin, hyaluronic acid và peptide vào trung bì để nuôi dưỡng và trẻ hóa da từ bên trong.',
  },
];

export const ServicesSection: React.FC = () => {
  return (
    <section
      id="services"
      className="relative w-full bg-[#FFFFFF] text-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 z-0"
    >
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <FadeIn delay={0} y={40}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="text-[#0C0C0C] font-heading font-black uppercase text-center leading-tight tracking-tight py-2 mb-16 sm:mb-20 md:mb-28"
          >
            Dịch vụ
          </h2>
        </FadeIn>

        {/* 5 Service Items */}
        <div className="flex flex-col divide-y divide-[rgba(12,12,12,0.15)] border-t border-b border-[rgba(12,12,12,0.15)]">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.id} delay={i * 0.1} y={30}>
              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 md:gap-14 py-8 sm:py-10 md:py-12">
                {/* Number on left */}
                <span
                  style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
                  className="font-heading font-black text-[#0C0C0C] leading-none select-none tracking-tighter flex-shrink-0"
                >
                  {service.number}
                </span>

                {/* Name + Description on right */}
                <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                  <h3
                    style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
                    className="font-heading font-semibold uppercase text-[#0C0C0C] tracking-wide"
                  >
                    {service.name}
                  </h3>
                  <p
                    style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}
                    className="font-sans font-normal leading-relaxed max-w-2xl text-[#0C0C0C] opacity-70"
                  >
                    {service.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
