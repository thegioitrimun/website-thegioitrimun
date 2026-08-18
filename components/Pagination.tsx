import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation();

  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage > halfPagesToShow + 2) {
        pageNumbers.push('...');
      }

      let startPage = Math.max(2, currentPage - halfPagesToShow);
      let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);

      if (currentPage <= halfPagesToShow + 1) {
        endPage = maxPagesToShow;
      }

      if (currentPage >= totalPages - halfPagesToShow) {
        startPage = totalPages - maxPagesToShow + 1;
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (currentPage < totalPages - halfPagesToShow - 1) {
        pageNumbers.push('...');
      }
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  return (
    <nav className="flex items-center justify-between border-t border-border px-4 py-4 sm:px-6 mt-4">
      <div className="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
        <div className="w-full text-left md:w-auto">
          <p className="text-sm text-muted-foreground">
            {t('pagination.page_status', { current: currentPage, total: totalPages })}
          </p>
        </div>
        <div className="w-full overflow-x-auto pb-2 md:w-auto md:overflow-visible md:pb-0 no-scrollbar">
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm min-w-max" aria-label={t('pagination.aria_label', 'Pagination')}>
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-l-md text-muted-foreground ring-1 ring-inset ring-border hover:bg-accent focus:z-20 focus:outline-offset-0 disabled:opacity-50 sm:h-10 sm:w-10"
            >
              <span className="sr-only">{t('pagination.previous', 'Previous')}</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            {getPageNumbers().map((page, index) =>
              typeof page === 'number' ? (
                <button
                  key={index}
                  onClick={() => onPageChange(page)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={`relative inline-flex h-9 min-w-[36px] items-center justify-center text-sm font-semibold sm:h-10 sm:min-w-[40px] ${
                    currentPage === page
                      ? 'z-10 bg-primary text-primary-foreground focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                      : 'text-foreground ring-1 ring-inset ring-border hover:bg-accent focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="relative inline-flex h-9 min-w-[36px] items-center justify-center text-sm font-semibold text-muted-foreground ring-1 ring-inset ring-border sm:h-10 sm:min-w-[40px]">
                  ...
                </span>
              )
            )}
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-r-md text-muted-foreground ring-1 ring-inset ring-border hover:bg-accent focus:z-20 focus:outline-offset-0 disabled:opacity-50 sm:h-10 sm:w-10"
            >
              <span className="sr-only">{t('pagination.next', 'Next')}</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </nav>
  );
};

export default Pagination;
