import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Container, 
  Grid, 
  Typography, 
  Card, 
  CardContent, 
  Box, 
  Chip, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableRow, 
  Paper,
  useTheme,
  ThemeProvider,
  createTheme,
  LinearProgress,
  TableHead
} from '@mui/material';
import { motion } from 'framer-motion';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { YoutubeApiManager, type EpisodeWithDate, type Livestream, type StatsResponse } from '../../../managers/YoutubeApiManager';

// Custom hook to fetch data
const useH3Data = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch stats
        const statsRes = await YoutubeApiManager.getInstance().getStats();
        setStats(statsRes);

        // Fetch livestreams (first 100 for performance)
        const streamsRes = await YoutubeApiManager.getInstance().getLivestreams(100, 0);
        setLivestreams(streamsRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        console.log('Loading finished');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { stats, livestreams, loading, error };
};

// Utility functions
const secondsToTime = (seconds: number): string => {
  const absSeconds = Math.abs(seconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const categorizeLateness = (seconds: number): 'early' | 'on-time' | 'late' => {
  if (seconds < -300) return 'early';
  if (seconds > 300) return 'late';
  return 'on-time';
};

const createTrendData = (livestreams: Livestream[]): EpisodeWithDate[] => {
  return livestreams
    .map(stream => ({
      title: stream.title,
      videoId: stream.videoId,
      lateTime: stream.lateTime,
      scheduledStartTime: stream.scheduledStartTime,
      date: format(parseISO(stream.scheduledStartTime), 'MMM yyyy')
    }))
    .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());
};

const getTopEpisodes = (livestreams: Livestream[], count: number, sort: 'most' | 'least' = 'most') => {
  return livestreams
    .sort((a, b) => sort === 'most' ? b.lateTime - a.lateTime : a.lateTime - b.lateTime)
    .slice(0, count)
    .map(stream => ({
      title: stream.title,
      videoId: stream.videoId,
      lateTime: stream.lateTime,
      category: categorizeLateness(stream.lateTime)
    }));
};

const getLatenessDistribution = (livestreams: Livestream[]) => {
  const counts = { early: 0, 'on-time': 0, late: 0 };
  livestreams.forEach(stream => {
    counts[categorizeLateness(stream.lateTime)]++;
  });
  return [
    { name: 'Early', value: counts.early, fill: '#4CAF50' },
    { name: 'On Time', value: counts['on-time'], fill: '#2196F3' },
    { name: 'Late', value: counts.late, fill: '#F44336' }
  ];
};

// Main Dashboard Component
const H3LatenessDashboard: React.FC = () => {
  const { stats, livestreams, loading, error } = useH3Data();

  // Memoized computed data
  const trendData = useMemo(() => createTrendData(livestreams), [livestreams]);
  const topMostLate = useMemo(() => getTopEpisodes(livestreams, 5, 'most'), [livestreams]);
  const topLeastLate = useMemo(() => getTopEpisodes(livestreams, 5, 'least'), [livestreams]);
  const latenessDistribution = useMemo(() => getLatenessDistribution(livestreams), [livestreams]);

  console.log('Dashboard render state:', { 
    stats: stats ? stats.streamCount : null, 
    livestreams: livestreams.length, 
    loading, 
    error,
    trendDataLength: trendData.length 
  });

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '70vh',
          backgroundColor: '#121212 !important',
          color: 'white !important'
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" as const }}
          style={{ width: 48, height: 48, marginRight: 16 }}
        >
          <div 
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              border: '4px solid #333',
              borderTop: '4px solid #B137C8',
              animation: 'spin 1s linear infinite'
            }} 
          />
        </motion.div>
        <Typography variant="h6" sx={{ color: 'white !important' }}>
          Loading H3 data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        py: 4, 
        backgroundColor: '#121212 !important',
        color: 'white !important'
      }}>
        <Typography variant="h6" sx={{ color: '#F44336 !important' }}>
          {error}
        </Typography>
        <Typography variant="body2" sx={{ color: '#b0b0b0 !important' }}>
          Try refreshing the page
        </Typography>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box sx={{ 
        textAlign: 'center', 
        py: 4, 
        backgroundColor: '#121212 !important',
        color: 'white !important',
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography variant="h6" sx={{ color: '#b0b0b0 !important' }}>
          No data available
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* OVERRIDE GLOBAL STYLES - This is the key fix! */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Override the problematic global styles */
        html, body {
          overflow: visible !important;
          height: auto !important;
          min-height: 100vh !important;
        }
        
        #react-root {
          overflow: visible !important;
          height: auto !important;
          min-height: 100vh !important;
        }
        
        .h3-dashboard-wrapper {
          background-color: #121212 !important;
          color: white !important;
          min-height: 100vh !important;
          overflow: visible !important;
        }
        
        .h3-dashboard-wrapper * {
          box-sizing: border-box;
        }
      `}</style>

      <ThemeProvider
        theme={createTheme({
          palette: {
            mode: 'dark',
            background: { 
              default: '#121212', 
              paper: '#1e1e1e' 
            },
            primary: { main: '#B137C8' },
            secondary: { main: '#7ED9F8' },
            error: { main: '#F44336' },
            success: { main: '#4CAF50' },
            info: { main: '#2196F3' },
            text: { 
              primary: '#ffffff', 
              secondary: '#b0b0b0' 
            }
          },
          components: {
            MuiCard: {
              styleOverrides: {
                root: {
                  background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)',
                  border: '1px solid #333',
                  transition: 'all 0.3s ease',
                  borderRadius: '8px',
                  color: 'white',
                  '&:hover': {
                    boxShadow: `0 8px 32px rgba(177, 55, 200, 0.2)`,
                    borderColor: '#B137C8'
                  }
                }
              }
            },
            MuiPaper: {
              styleOverrides: {
                root: {
                  backgroundColor: 'transparent',
                  color: 'white'
                }
              }
            },
            MuiContainer: {
              styleOverrides: {
                root: {
                  backgroundColor: '#121212',
                  color: 'white',
                  padding: '32px 16px'
                }
              }
            }
          }
        })}
      >
        <div className="h3-dashboard-wrapper">
          <Container maxWidth="xl" sx={{ py: 4, minHeight: '100vh', backgroundColor: '#121212' }}>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Header */}
              <Box sx={{ 
                textAlign: 'center', 
                mb: 6,
                backgroundColor: '#121212',
                color: 'white',
                padding: '32px 0'
              }}>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Typography 
                    variant="h2" 
                    sx={{ 
                      fontWeight: 'bold',
                      background: `linear-gradient(45deg, #B137C8, #7ED9F8)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 1,
                      textShadow: '0 0 30px rgba(177, 55, 200, 0.5)'
                    }}
                  >
                    H3 Podcast Lateness Tracker
                  </Typography>
                </motion.div>
                <Typography 
                  variant="h6" 
                  sx={{ color: '#b0b0b0' }}
                >
                  Tracking {stats.streamCount} episodes • Last updated {formatDistanceToNow(parseISO(stats.lastUpdateDate), { addSuffix: true })}
                </Typography>
                <Chip 
                  label={stats.humanReadable} 
                  size="small" 
                  sx={{ 
                    mt: 2, 
                    background: 'linear-gradient(45deg, #B137C8, #7ED9F8)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Box>

              {/* Main content - Simple staggered animation, no scroll dependency */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                {/* Hero Stats Row */}
                <Grid container spacing={3} mb={6}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Card sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Most Recent Delay
                          </Typography>
                          <Typography variant="h3" sx={{ color: '#B137C8', mb: 1 }}>
                            {secondsToTime(stats.mostRecent.lateTime)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            "{stats.mostRecent.title}"
                          </Typography>
                          <Chip 
                            label={categorizeLateness(stats.mostRecent.lateTime)} 
                            color={categorizeLateness(stats.mostRecent.lateTime) === 'late' ? 'error' : 
                                  categorizeLateness(stats.mostRecent.lateTime) === 'early' ? 'success' : 'info'}
                            size="small"
                          />
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Average Delay
                          </Typography>
                          <Typography variant="h3" sx={{ color: '#7ED9F8', mb: 1 }}>
                            {secondsToTime(stats.averageLateTime)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Across {stats.streamCount} episodes
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Card sx={{ height: '100%' }}>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Worst Offense
                          </Typography>
                          <Typography variant="h3" sx={{ color: '#F44336', mb: 1 }}>
                            {secondsToTime(stats.max.lateTime)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 2 }}>
                            "{stats.max.title}"
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.min((stats.max.lateTime / 7200) * 100, 100)}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: '#333',
                              '& .MuiLinearProgress-bar': {
                                background: `linear-gradient(90deg, #B137C8, #7ED9F8)`
                              }
                            }}
                          />
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </Grid>

                {/* Charts Row */}
                <Grid container spacing={3} mb={6}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ color: '#B137C8' }}>
                            Lateness Distribution ({livestreams.length} episodes)
                          </Typography>
                          <Box sx={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={latenessDistribution}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                                >
                                  {latenessDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value) => [value, 'Episodes']}
                                  labelFormatter={(label) => `${label} starts`}
                                  contentStyle={{
                                    backgroundColor: '#1e1e1e',
                                    border: '1px solid #B137C8',
                                    color: '#ffffff'
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ color: '#B137C8' }}>
                            Lateness Trend Over Time
                          </Typography>
                          <Box sx={{ height: 300, width: '100%' }}>
                            {trendData.length > 0 ? (
                              <ResponsiveContainer>
                                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                  <XAxis dataKey="date" stroke="#b0b0b0" tickLine={false} axisLine={false} />
                                  <YAxis stroke="#b0b0b0" tickLine={false} axisLine={false} tickFormatter={(value: number) => `${(value / 60).toFixed(0)}m`} />
                                  <Tooltip 
                                    labelFormatter={(label) => `Episode: ${label}`}
                                    formatter={(value: number) => [secondsToTime(value), 'Lateness']}
                                    contentStyle={{
                                      backgroundColor: '#1e1e1e',
                                      border: '1px solid #B137C8',
                                      color: '#ffffff'
                                    }}
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="lateTime" 
                                    stroke="#B137C8" 
                                    strokeWidth={3}
                                    dot={{ fill: '#7ED9F8', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            ) : (
                              <Box sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                color: '#b0b0b0'
                              }}>
                                <Typography>No trend data available</Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </Grid>

                {/* Daily Averages & Top Episodes */}
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ color: '#B137C8' }}>
                            Average Delay by Day
                          </Typography>
                          <Box sx={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer>
                              <BarChart data={Object.entries(stats.daily).map(([day, data]) => ({
                                day: day.charAt(0).toUpperCase() + day.slice(1),
                                avgDelay: data.totalLateTime / data.count,
                                count: data.count
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="day" stroke="#b0b0b0" tickLine={false} axisLine={false} />
                                <YAxis stroke="#b0b0b0" tickLine={false} axisLine={false} tickFormatter={(value: number) => `${(value / 60).toFixed(0)}m`} />
                                <Tooltip 
                                  formatter={(value: number) => [secondsToTime(value), 'Average Delay']}
                                  labelFormatter={(label) => `Day: ${label}`}
                                  contentStyle={{
                                    backgroundColor: '#1e1e1e',
                                    border: '1px solid #B137C8',
                                    color: '#ffffff'
                                  }}
                                />
                                <Bar dataKey="avgDelay" fill="#B137C8" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ color: '#B137C8' }}>
                            Top 5 Most Delinquent Episodes
                          </Typography>
                          <TableContainer component={Paper} sx={{ background: 'transparent' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: '#b0b0b0', fontWeight: 'bold' }}>Episode</TableCell>
                                  <TableCell sx={{ color: '#b0b0b0', fontWeight: 'bold', textAlign: 'right' }}>Delay</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {topMostLate.map((episode, index) => (
                                  <TableRow key={episode.videoId} hover>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip 
                                          label={index + 1} 
                                          size="small" 
                                          sx={{ 
                                            background: `linear-gradient(45deg, #B137C8, #7ED9F8)`,
                                            color: 'white',
                                            fontWeight: 'bold',
                                            width: 28,
                                            height: 28
                                          }}
                                        />
                                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                          {episode.title}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Chip 
                                        label={secondsToTime(episode.lateTime)} 
                                        size="small"
                                        color="error"
                                        sx={{ fontWeight: 'bold' }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </Grid>

                {/* Hall of Fame */}
                <Grid container spacing={3} mt={3}>
                  <Grid size={{ xs: 12 }}>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom sx={{ color: '#B137C8' }}>
                            Hall of Fame: Most Punctual Episodes
                          </Typography>
                          <TableContainer component={Paper} sx={{ background: 'transparent' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: '#b0b0b0', fontWeight: 'bold' }}>Episode</TableCell>
                                  <TableCell sx={{ color: '#b0b0b0', fontWeight: 'bold', textAlign: 'right' }}>Timing</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {topLeastLate.map((episode, index) => (
                                  <TableRow key={episode.videoId} hover>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip 
                                          label={index + 1} 
                                          size="small" 
                                          sx={{ 
                                            background: 'linear-gradient(45deg, #4CAF50, #2196F3)',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            width: 28,
                                            height: 28
                                          }}
                                        />
                                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                          {episode.title}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Chip 
                                        label={secondsToTime(episode.lateTime)} 
                                        size="small"
                                        color={episode.category === 'early' ? 'success' : 'info'}
                                        sx={{ fontWeight: 'bold' }}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </Grid>

                {/* Footer */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <Box sx={{ 
                    mt: 8, 
                    textAlign: 'center', 
                    py: 4, 
                    borderTop: '1px solid #333',
                    backgroundColor: '#121212',
                    color: '#b0b0b0'
                  }}>
                    <Typography variant="body2">
                      Made with ❤️ for H3 fans • Total lost time: {secondsToTime(stats.totalLateTime)}
                    </Typography>
                  </Box>
                </motion.div>
              </motion.div>
            </motion.div>
          </Container>
        </div>
      </ThemeProvider>
    </>
  );
};

export default H3LatenessDashboard;