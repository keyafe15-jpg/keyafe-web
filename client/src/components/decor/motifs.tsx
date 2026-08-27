import type { SVGProps } from "react";

type MotifProps = SVGProps<SVGSVGElement>;

export function Cupcake(props: MotifProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* wrapper */}
      <path d="M18 34h28l-4 22a3 3 0 0 1-3 2H25a3 3 0 0 1-3-2z" />
      <path d="M22 40h20" />
      <path d="M24 46h16" />
      {/* icing swirl */}
      <path d="M18 34c0-6 5-10 10-10 1-4 5-6 8-6 4 0 8 3 8 8 4 1 6 4 6 8H18z" />
      {/* cherry */}
      <circle cx={32} cy={15} r={3} fill="currentColor" stroke="none" />
      <path d="M32 12c1-2 3-3 5-2" />
    </svg>
  );
}

export function Cookie(props: MotifProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={32} cy={32} r={22} />
      <circle cx={24} cy={26} r={2} fill="currentColor" stroke="none" />
      <circle cx={38} cy={22} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={40} cy={36} r={2.2} fill="currentColor" stroke="none" />
      <circle cx={26} cy={40} r={1.8} fill="currentColor" stroke="none" />
      <circle cx={32} cy={32} r={1.4} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Whisk(props: MotifProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* handle */}
      <path d="M12 12l16 16" />
      {/* base cap */}
      <path d="M28 28l6 6" />
      {/* whisk hoops */}
      <path d="M28 28c8-2 18 2 22 10 -8 4-18 0-22-10z" />
      <path d="M32 28c6 0 14 4 18 12" />
      <path d="M36 28c4 2 10 6 14 12" />
    </svg>
  );
}
