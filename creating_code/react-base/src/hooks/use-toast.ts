import React from 'react';
import { useTheme } from '@/hooks/use-theme';
import { Card, Grid, Typography, Button, Box } from '@mui/material';

const DashboardPage: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Box sx={{ padding: theme.spacing(3) }}>
      <Typography variant="h4" gutterBottom>
        Welcome to Your Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ padding: theme.spacing(2) }}>
            <Typography variant="h6">Your Courses</Typography>
            {/* Add a list or grid of user's enrolled courses */}
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ padding: theme.spacing(2) }}>
            <Typography variant="h6">Progress Overview</Typography>
            {/* Add progress charts or statistics */}
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ padding: theme.spacing(2) }}>
            <Typography variant="h6">Upcoming Deadlines</Typography>
            {/* Add a list of upcoming assignment deadlines */}
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ padding: theme.spacing(2) }}>
            <Typography variant="h6">Recent Activities</Typography>
            {/* Add a list of recent user activities */}
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ padding: theme.spacing(2) }}>
            <Typography variant="h6">Recommendations</Typography>
            {/* Add recommended courses or resources */}
          </Card>
        </Grid>
      </Grid>
      
      <Box sx={{ marginTop: theme.spacing(3) }}>
        <Button variant="contained" color="primary">
          Explore More Courses
        </Button>
      </Box>
    </Box>
  );
};

export default DashboardPage;