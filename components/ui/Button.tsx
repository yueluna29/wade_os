import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "font-nunito font-bold transition-all duration-200 rounded-full flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-wade-accent text-white hover:bg-wade-accent-hover shadow-md hover:shadow-lg",
    secondary: "bg-wade-text-muted text-white hover:bg-wade-text-muted shadow-md",
    outline: "border-2 border-wade-accent text-wade-accent hover:bg-wade-accent hover:text-white",
    ghost: "text-wade-text-muted hover:bg-wade-border"
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-5 py-2 text-base",
    lg: "px-8 py-3 text-lg"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};