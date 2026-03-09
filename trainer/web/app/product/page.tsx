import { ProductsView } from '../products/products-view';

export default function ProductPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/trainer/Brand_symbol_1.svg"
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
        />
      </div>

      <ProductsView title="Lorenzo's products" titleLogoSrc="/trainer/Logo1.png" />
    </div>
  );
}
