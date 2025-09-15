import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, BarChart3, PieChart, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary border-primary/20">
            Portfolio Management Platform
          </Badge>
          <h1 className="mb-6 text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Track Your Investments with{' '}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Precision
            </span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Comprehensive portfolio tracking, real-time market data, and advanced analytics 
            to help you make informed investment decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <Link to="/auth">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-primary/20 hover:bg-primary/5">
              <Link to="/dashboard">
                View Demo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything you need to manage your portfolio</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From basic tracking to advanced analytics, our platform provides the tools 
              professional investors need.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Real-time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Monitor your investments with live market data and instant portfolio updates.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-profit/10 flex items-center justify-center mb-4 group-hover:bg-profit/20 transition-colors">
                  <BarChart3 className="h-6 w-6 text-profit" />
                </div>
                <CardTitle className="text-xl">Performance Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Detailed P&L analysis, cost basis tracking, and performance metrics.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center mb-4 group-hover:bg-warning/20 transition-colors">
                  <PieChart className="h-6 w-6 text-warning" />
                </div>
                <CardTitle className="text-xl">Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Visualize your asset allocation and maintain balanced investment strategies.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
              <CardHeader className="pb-4">
                <div className="h-12 w-12 rounded-lg bg-secondary/50 flex items-center justify-center mb-4 group-hover:bg-secondary/70 transition-colors">
                  <Shield className="h-6 w-6 text-secondary-foreground" />
                </div>
                <CardTitle className="text-xl">Secure & Private</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Bank-level security with encrypted data storage and user authentication.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20 md:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Multi-Asset Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Track stocks, ETFs, cryptocurrencies, and more across multiple portfolios.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Stocks</Badge>
                  <Badge variant="outline">ETFs</Badge>
                  <Badge variant="outline">Crypto</Badge>
                  <Badge variant="outline">Bonds</Badge>
                  <Badge variant="outline">Options</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 bg-primary/5">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to take control of your investments?</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of investors who trust our platform to manage their portfolios effectively.
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
            <Link to="/auth">
              Start Tracking Today
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;