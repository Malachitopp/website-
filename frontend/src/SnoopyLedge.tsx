import { useId } from 'react'

function SnoopyLedge() {
  const clipId = useId()

  return (
    <svg
      className="snoopy-ledge"
      viewBox="172 398 856 382"
      aria-hidden="true"
      focusable="false"
      stroke="#111"
      strokeWidth={10}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="172" y="0" width="856" height="732" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <g className="snoopy-ledge__head">
          <path
            d="M333 800 L333 690 C328 590 350 515 415 462 C468 420 540 405 590 412 C632 418 662 440 692 462 C722 482 770 486 810 508 C845 532 862 580 860 630 C858 680 852 720 848 800 Z"
            fill="#fff"
          />
          <path d="M390 545 C420 560 446 625 448 800 L350 800 C346 660 358 582 390 545 Z" fill="#111" stroke="none" />
          <path d="M370 604 L390 558 M361 652 L384 584 M356 704 L372 622" stroke="#fff" strokeWidth={6} fill="none" />
          <path d="M432 568 C458 620 470 690 472 800" fill="none" />

          <path d="M540 458 C552 444 578 440 602 446 M606 432 C622 430 636 436 644 446" strokeWidth={8} fill="none" />
          <path d="M553 548 C552 520 580 508 596 538 M622 545 C625 525 648 520 660 538" strokeWidth={8} fill="none" />
          <ellipse className="snoopy-ledge__eye" cx="566" cy="563" rx="11" ry="20" fill="#111" stroke="none" />
          <ellipse className="snoopy-ledge__eye" cx="633" cy="563" rx="10" ry="18" fill="#111" stroke="none" />
          <ellipse cx="721" cy="648" rx="44" ry="28" fill="#111" stroke="none" />
          <path d="M518 662 C510 690 530 722 562 734" strokeWidth={8} fill="none" />
        </g>
      </g>

      <path className="snoopy-ledge__line" d="M182 732 H1018" fill="none" />

      <path
        className="snoopy-ledge__paw"
        d="M238 732 C236 700 268 674 315 674 C362 674 400 696 412 724 C420 745 412 766 394 766 C384 766 376 762 372 756 C366 768 350 772 340 770 C330 769 324 764 322 756 C312 770 290 772 270 768 C248 764 238 750 238 732 Z M372 756 C374 745 374 735 372 726 M322 756 C324 745 324 736 322 728"
        fill="#fff"
      />
      <path
        className="snoopy-ledge__paw"
        d="M785 730 C790 700 830 674 880 674 C928 674 962 698 966 728 C970 752 952 768 930 768 C918 768 910 764 906 756 C900 768 886 772 876 770 C866 769 860 764 858 756 C850 768 832 770 818 766 C796 760 782 748 785 730 Z M906 756 C908 745 908 736 906 728 M858 756 C860 745 860 736 858 728"
        fill="#fff"
      />
    </svg>
  )
}

export default SnoopyLedge
