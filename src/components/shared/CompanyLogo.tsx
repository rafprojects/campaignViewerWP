import { Image } from '@mantine/core';

interface CompanyLogoProps {
  logo: string;
  companyName: string;
  size?: number;
}

const URL_PATTERN = /^(https?:\/\/|\/|data:)/i;

export function CompanyLogo({ logo, companyName, size = 20 }: CompanyLogoProps) {
  if (URL_PATTERN.test(logo)) {
    return <Image src={logo} alt={companyName} w={size} h={size} fit="contain" />;
  }
  return <span>{logo}</span>;
}
