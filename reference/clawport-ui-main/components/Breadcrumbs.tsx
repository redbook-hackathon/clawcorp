'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="animate-fade-in"
      style={{
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        lineHeight: 1,
        fontWeight: 500,
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                minWidth: 0,
              }}
            >
              {index > 0 && (
                <ChevronRight
                  size={12}
                  style={{
                    color: 'var(--text-quaternary)',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
              )}

              {isLast || !item.href ? (
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                  }}
                  aria-current="page"
                >
                  {item.icon && (
                    <span
                      style={{
                        display: 'inline-flex',
                        verticalAlign: 'middle',
                        marginRight: '4px',
                      }}
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="breadcrumb-link focus-ring"
                  style={{
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    margin: '-2px -4px',
                    transition: 'color 100ms var(--ease-smooth)',
                  }}
                  aria-label={item.label}
                >
                  {item.icon && (
                    <span
                      style={{
                        display: 'inline-flex',
                        verticalAlign: 'middle',
                        marginRight: '4px',
                      }}
                    >
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
