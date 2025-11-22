import { Card } from "../components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DailyStats } from "../shared/schema";
import { formatLateTime } from "../lib/utils";

interface DayOfWeekChartProps {
  dailyStats: DailyStats;
}

export function DayOfWeekChart({ dailyStats }: DayOfWeekChartProps) {
  const chartData = [
    { 
      day: 'SUN', 
      avgLateMinutes: dailyStats.sunday.count > 0 
        ? Math.floor(dailyStats.sunday.totalLateTime / dailyStats.sunday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.sunday.count > 0 
        ? Math.floor(dailyStats.sunday.totalLateTime / dailyStats.sunday.count) 
        : 0,
      count: dailyStats.sunday.count 
    },
    { 
      day: 'MON', 
      avgLateMinutes: dailyStats.monday.count > 0 
        ? Math.floor(dailyStats.monday.totalLateTime / dailyStats.monday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.monday.count > 0 
        ? Math.floor(dailyStats.monday.totalLateTime / dailyStats.monday.count) 
        : 0,
      count: dailyStats.monday.count 
    },
    { 
      day: 'TUE', 
      avgLateMinutes: dailyStats.tuesday.count > 0 
        ? Math.floor(dailyStats.tuesday.totalLateTime / dailyStats.tuesday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.tuesday.count > 0 
        ? Math.floor(dailyStats.tuesday.totalLateTime / dailyStats.tuesday.count) 
        : 0,
      count: dailyStats.tuesday.count 
    },
    { 
      day: 'WED', 
      avgLateMinutes: dailyStats.wednesday.count > 0 
        ? Math.floor(dailyStats.wednesday.totalLateTime / dailyStats.wednesday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.wednesday.count > 0 
        ? Math.floor(dailyStats.wednesday.totalLateTime / dailyStats.wednesday.count) 
        : 0,
      count: dailyStats.wednesday.count 
    },
    { 
      day: 'THU', 
      avgLateMinutes: dailyStats.thursday.count > 0 
        ? Math.floor(dailyStats.thursday.totalLateTime / dailyStats.thursday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.thursday.count > 0 
        ? Math.floor(dailyStats.thursday.totalLateTime / dailyStats.thursday.count) 
        : 0,
      count: dailyStats.thursday.count 
    },
    { 
      day: 'FRI', 
      avgLateMinutes: dailyStats.friday.count > 0 
        ? Math.floor(dailyStats.friday.totalLateTime / dailyStats.friday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.friday.count > 0 
        ? Math.floor(dailyStats.friday.totalLateTime / dailyStats.friday.count) 
        : 0,
      count: dailyStats.friday.count 
    },
    { 
      day: 'SAT', 
      avgLateMinutes: dailyStats.saturday.count > 0 
        ? Math.floor(dailyStats.saturday.totalLateTime / dailyStats.saturday.count / 60) 
        : 0,
      avgLateSeconds: dailyStats.saturday.count > 0 
        ? Math.floor(dailyStats.saturday.totalLateTime / dailyStats.saturday.count) 
        : 0,
      count: dailyStats.saturday.count 
    },
  ];

  return (
    <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-secondary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 space-y-6">
        <h2 className="font-pixel text-xl md:text-2xl text-center text-secondary drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]" data-testid="heading-day-of-week">
          AVG LATE TIME BY DAY
        </h2>
        
        <div className="w-full h-56 md:h-72" data-testid="chart-day-of-week">
          <ResponsiveContainer width="100%" height="100%" minHeight={224}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="day" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '18px', fontWeight: 'bold' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '16px' }}
                label={{ value: 'Avg Minutes', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontFamily: 'VT323, monospace', fontSize: '18px' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '2px solid hsl(var(--secondary))',
                  borderRadius: '4px',
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  boxShadow: '0 0 15px rgba(236,72,153,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--secondary))' }}
                formatter={(_value: number, _name: string, props: any) => [
                  `${formatLateTime(props.payload.avgLateSeconds)} avg (${props.payload.count} streams)`,
                  'Avg Late'
                ]}
              />
              <Bar 
                dataKey="avgLateMinutes" 
                fill="hsl(var(--chart-2))" 
                radius={[4, 4, 0, 0]}
                style={{ filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.4))' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
    </Card>
  );
}
