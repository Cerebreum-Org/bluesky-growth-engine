
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/analytics" | "/api" | "/api/analytics" | "/api/communities" | "/api/graph" | "/api/growth-insights" | "/api/predictions" | "/api/search" | "/api/stats" | "/demo" | "/demo/lucia" | "/demo/lucia/login" | "/demo/paraglide";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/analytics": Record<string, never>;
			"/api": Record<string, never>;
			"/api/analytics": Record<string, never>;
			"/api/communities": Record<string, never>;
			"/api/graph": Record<string, never>;
			"/api/growth-insights": Record<string, never>;
			"/api/predictions": Record<string, never>;
			"/api/search": Record<string, never>;
			"/api/stats": Record<string, never>;
			"/demo": Record<string, never>;
			"/demo/lucia": Record<string, never>;
			"/demo/lucia/login": Record<string, never>;
			"/demo/paraglide": Record<string, never>
		};
		Pathname(): "/" | "/analytics" | "/analytics/" | "/api" | "/api/" | "/api/analytics" | "/api/analytics/" | "/api/communities" | "/api/communities/" | "/api/graph" | "/api/graph/" | "/api/growth-insights" | "/api/growth-insights/" | "/api/predictions" | "/api/predictions/" | "/api/search" | "/api/search/" | "/api/stats" | "/api/stats/" | "/demo" | "/demo/" | "/demo/lucia" | "/demo/lucia/" | "/demo/lucia/login" | "/demo/lucia/login/" | "/demo/paraglide" | "/demo/paraglide/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}