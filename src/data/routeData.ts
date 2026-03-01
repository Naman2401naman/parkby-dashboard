// Hardcoded routes between gates and parking areas
export interface RouteData {
    from: string; // gate id
    to: string; // parking id
    coordinates: [number, number][]; // [lng, lat] waypoints
    distance: number; // meters
    duration: number; // seconds
}

export const routes: RouteData[] = [
    // Main Gate to Lower 1st Year
    {
        from: 'main',
        to: 'lower-1st',
        coordinates: [
            [79.0615, 21.1778], // Main gate
            [79.0613, 21.1777],
            [79.0611, 21.1776],
            [79.061, 21.1776]   // Lower 1st
        ],
        distance: 120,
        duration: 90
    },
    // Main Gate to Upper 1st Year
    {
        from: 'main',
        to: 'upper-1st',
        coordinates: [
            [79.0615, 21.1778], // Main gate
            [79.0616, 21.1778],
            [79.0617, 21.1779]  // Upper 1st
        ],
        distance: 180,
        duration: 135
    },
    // Main Gate to DT Parking
    {
        from: 'main',
        to: 'dt',
        coordinates: [
            [79.0615, 21.1778], // Main gate
            [79.0616, 21.1775],
            [79.0618, 21.1772],
            [79.0619, 21.1769]  // DT
        ],
        distance: 380,
        duration: 285
    },
    // Main Gate to IT Parking
    {
        from: 'main',
        to: 'it',
        coordinates: [
            [79.0615, 21.1778], // Main gate
            [79.0618, 21.1774],
            [79.0622, 21.1770],
            [79.0625, 21.1767]  // IT
        ],
        distance: 420,
        duration: 315
    },
    // North Gate to Lower 1st Year
    {
        from: 'north',
        to: 'lower-1st',
        coordinates: [
            [79.0623, 21.1782], // North gate
            [79.0620, 21.1780],
            [79.0615, 21.1778],
            [79.061, 21.1776]   // Lower 1st
        ],
        distance: 240,
        duration: 180
    },
    // North Gate to Upper 1st Year
    {
        from: 'north',
        to: 'upper-1st',
        coordinates: [
            [79.0623, 21.1782], // North gate
            [79.0621, 21.1781],
            [79.0619, 21.1780],
            [79.0617, 21.1779]  // Upper 1st
        ],
        distance: 200,
        duration: 150
    },
    // North Gate to DT Parking
    {
        from: 'north',
        to: 'dt',
        coordinates: [
            [79.0623, 21.1782], // North gate
            [79.0621, 21.1778],
            [79.0620, 21.1773],
            [79.0619, 21.1769]  // DT
        ],
        distance: 260,
        duration: 195
    },
    // North Gate to IT Parking
    {
        from: 'north',
        to: 'it',
        coordinates: [
            [79.0623, 21.1782], // North gate
            [79.0624, 21.1778],
            [79.0625, 21.1773],
            [79.0625, 21.1767]  // IT
        ],
        distance: 320,
        duration: 240
    }
];

export function getRoute(fromGateId: string, toParkingId: string): RouteData | undefined {
    return routes.find(r => r.from === fromGateId && r.to === toParkingId);
}

export function getRoutesFromGate(gateId: string): RouteData[] {
    return routes.filter(r => r.from === gateId);
}
