import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    const watermarkUrl = `${window.location.origin}/eolo-plus.png`;

    return (
         <img
            src={watermarkUrl}
            alt="Logo"
            className="h-8 w-auto"
        />
    );
}
