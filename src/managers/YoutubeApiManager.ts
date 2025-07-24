import axios from 'axios';
import { config } from '../config'

export interface StatsResponse {
    humanReadable: any;
    totalLateTime: number;
    averageLateTime: number;
    maxLateTime: number;
    daily: {
        sunday: { count: number; totalLateTime: number };
        monday: { count: number; totalLateTime: number };
        tuesday: { count: number; totalLateTime: number };
        wednesday: { count: number; totalLateTime: number };
        thursday: { count: number; totalLateTime: number };
        friday: { count: number; totalLateTime: number };
        saturday: { count: number; totalLateTime: number };
    },
    lastUpdateDate: string;
}

interface ErrorResponse {
    message: string;
    details: Record<string, any>;
}

export class YoutubeApiManager {
    private static instance: YoutubeApiManager;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = config.YOUTUBE_API_HOST;
    }

    public static getInstance(): YoutubeApiManager {
        if (!YoutubeApiManager.instance) {
            YoutubeApiManager.instance = new YoutubeApiManager();
        }
        return YoutubeApiManager.instance;
    }

    public async getStats(): Promise<StatsResponse> {
        try {
            const response = await axios.get<StatsResponse>(`${this.baseUrl}/api/stats`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data as ErrorResponse;
                console.error('YouTube API Error:', errorData.message);
                throw errorData;
            } else {
                console.error('Unexpected error:', error);
                throw {
                    message: 'Failed to fetch YouTube stats',
                    details: { originalError: error }
                } as ErrorResponse;
            }
        }
    }
}

