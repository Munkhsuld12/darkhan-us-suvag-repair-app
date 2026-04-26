import type { HTMLAttributes } from "react";

interface BrandLogoProps extends HTMLAttributes<HTMLDivElement> {
  imageClassName?: string;
}

export const BrandLogo = ({ className = "", imageClassName = "", ...props }: BrandLogoProps) => (
  <div className={`inline-flex items-center ${className}`.trim()} {...props}>
    <img
      alt="Дархан Ус Суваг ХК"
      className={`h-9 w-auto object-contain sm:h-10 ${imageClassName}`.trim()}
      src="/DUS-name-logo-out-light.png"
    />
  </div>
);
