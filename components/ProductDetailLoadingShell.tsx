import React from 'react';

const SkeletonBlock: React.FC<{ className: string }> = ({ className }) => (
    <span aria-hidden="true" className={`block animate-pulse rounded-2xl bg-muted/80 ${className}`} />
);

const ProductDetailLoadingShell: React.FC = () => (
    <div
        className="product-detail-loading-shell min-h-[calc(100vh-6rem)] bg-background px-4 pb-20 pt-4 text-foreground md:px-6 md:pb-16 md:pt-8"
        role="status"
        aria-busy="true"
        aria-label="Đang tải toàn bộ thông tin sản phẩm"
    >
        <span className="sr-only">Đang tải toàn bộ thông tin sản phẩm...</span>
        <div className="container mx-auto">
            <div className="mb-5 flex items-center gap-2 md:mb-8">
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="h-4 w-3" />
                <SkeletonBlock className="h-4 w-40 max-w-[45vw]" />
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:gap-8 xl:gap-10">
                <div className="overflow-hidden rounded-[28px] border border-border bg-card">
                    <SkeletonBlock className="aspect-square w-full rounded-none lg:aspect-[0.96/1]" />
                </div>

                <div className="rounded-[28px] border border-border bg-card p-5 md:p-7">
                    <SkeletonBlock className="mx-auto h-4 w-24 md:mx-0" />
                    <SkeletonBlock className="mx-auto mt-5 h-8 w-[88%] md:mx-0 md:h-11" />
                    <SkeletonBlock className="mx-auto mt-3 h-8 w-[68%] md:mx-0 md:h-11" />
                    <div className="mt-6 space-y-3">
                        <SkeletonBlock className="h-4 w-full" />
                        <SkeletonBlock className="h-4 w-[94%]" />
                        <SkeletonBlock className="h-4 w-[72%]" />
                    </div>
                    <SkeletonBlock className="mt-7 h-10 w-44" />
                    <div className="mt-8 grid grid-cols-[112px_1fr] gap-3">
                        <SkeletonBlock className="h-14 w-full rounded-full" />
                        <SkeletonBlock className="h-14 w-full rounded-full" />
                    </div>
                </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-border bg-card p-5 md:mt-10 md:p-8">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="mt-4 h-8 w-64 max-w-full" />
                <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(310px,1fr)]">
                    <div className="space-y-3">
                        <SkeletonBlock className="h-5 w-full" />
                        <SkeletonBlock className="h-5 w-[96%]" />
                        <SkeletonBlock className="h-5 w-[88%]" />
                        <SkeletonBlock className="h-5 w-[74%]" />
                    </div>
                    <SkeletonBlock className="h-48 w-full rounded-[24px]" />
                </div>
            </div>
        </div>
    </div>
);

export default ProductDetailLoadingShell;
