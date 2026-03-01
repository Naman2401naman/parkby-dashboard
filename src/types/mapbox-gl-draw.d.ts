declare module '@mapbox/mapbox-gl-draw' {
    import { IControl, Map } from 'mapbox-gl';

    export interface DrawOptions {
        displayControlsDefault?: boolean;
        defaultMode?: string;
        controls?: {
            point?: boolean;
            line_string?: boolean;
            polygon?: boolean;
            trash?: boolean;
            combine_features?: boolean;
            uncombine_features?: boolean;
        };
        styles?: any[];
    }

    export default class MapboxDraw implements IControl {
        constructor(options?: DrawOptions);
        onAdd(map: Map): HTMLElement;
        onRemove(map: Map): void;
        changeMode(mode: string, options?: any): void;
        getMode(): string;
        getAll(): any;
        getSelected(): any;
        getSelectedIds(): string[];
        get(id: string): any;
        getFeatureIdsAt(point: { x: number; y: number }): string[];
        add(geojson: any): string[];
        set(featureCollection: any): string[];
        delete(ids: string | string[]): this;
        deleteAll(): this;
        setFeatureProperty(featureId: string, property: string, value: any): this;
        trash(): void;
        combineFeatures(): void;
        uncombineFeatures(): void;
    }
}
