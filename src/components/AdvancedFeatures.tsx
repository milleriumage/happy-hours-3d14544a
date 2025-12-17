import { useState } from 'react';
import { Session } from '../types';
import { Spinner } from './Spinner';
import { useToast } from './ui/toast';
import { supabase } from '../integrations/supabase/client';

interface AdvancedFeaturesProps {
  session: Session;
}

export const AdvancedFeatures = ({ session }: AdvancedFeaturesProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState('');
  const [productData, setProductData] = useState<any>(null);
  const [avatarUsername, setAvatarUsername] = useState('');
  const [avatarData, setAvatarData] = useState<any>(null);

  const fetchProduct = async () => {
    if (!productId.trim()) return;
    
    setIsLoading(true);
    try {
      const sessionData = JSON.parse(session.token);
      const { data, error } = await supabase.functions.invoke('imvu-api-proxy', {
        body: { 
          session: sessionData,
          action: 'getProduct',
          productId: productId.trim()
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setProductData(data.product);
      toast({ title: 'Product loaded!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvatar = async () => {
    if (!avatarUsername.trim()) return;
    
    setIsLoading(true);
    try {
      const sessionData = JSON.parse(session.token);
      const { data, error } = await supabase.functions.invoke('imvu-api-proxy', {
        body: { 
          session: sessionData,
          action: 'getUser',
          username: avatarUsername.trim()
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAvatarData(data.user);
      toast({ title: 'Avatar loaded!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getOutfit = async () => {
    if (!avatarData?.id && !avatarData?.legacy_cid) {
      toast({ title: 'Search for an avatar first', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const sessionData = JSON.parse(session.token);
      const userId = avatarData.legacy_cid || avatarData.id;
      
      const { data, error } = await supabase.functions.invoke('imvu-api-proxy', {
        body: { 
          session: sessionData,
          action: 'getOutfit',
          userId: userId
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: `Outfit has ${data.outfit?.length || 0} products`,
        description: 'Check console for details',
      });
      console.log('Full outfit:', data.outfit);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '2rem',
    }}>
      <h2 style={{ marginTop: 0 }}>🚀 Advanced API Features</h2>

      {/* Product Search */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>📦 Search Product</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Product ID (e.g. 120461861 or 120461861-965)"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchProduct()}
            className="search-input"
            style={{ flex: 1 }}
          />
          <button onClick={fetchProduct} className="btn" disabled={isLoading}>
            {isLoading && <Spinner />}
            Search
          </button>
        </div>
        {productData && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '1rem',
            borderRadius: '6px',
            marginTop: '0.5rem',
          }}>
            {productData.product_image && (
              <img 
                src={productData.product_image} 
                alt={productData.name || productData.product_name}
                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.5rem' }}
              />
            )}
            <h4 style={{ margin: '0 0 0.5rem 0' }}>{productData.name || productData.product_name}</h4>
            <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
              <strong>Creator:</strong> {productData.creator_name}
            </p>
            <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
              <strong>Price:</strong> {productData.price_in_credits || productData.product_price} credits
            </p>
            <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
              <strong>Rating:</strong> {productData.rating} ⭐
            </p>
          </div>
        )}
      </div>

      {/* Avatar Info */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>👤 Avatar Info</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Username"
            value={avatarUsername}
            onChange={(e) => setAvatarUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchAvatar()}
            className="search-input"
            style={{ flex: 1 }}
          />
          <button onClick={fetchAvatar} className="btn" disabled={isLoading}>
            {isLoading && <Spinner />}
            Search
          </button>
        </div>
        {avatarData && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '1rem',
            borderRadius: '6px',
            marginTop: '0.5rem',
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {avatarData.avatar_image && (
                <img
                  src={avatarData.avatar_image}
                  alt={avatarData.username}
                  style={{ width: '64px', height: '64px', borderRadius: '50%' }}
                />
              )}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>
                  {avatarData.display_name || avatarData.username}
                </h4>
                <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                  <strong>ID:</strong> {avatarData.legacy_cid || avatarData.id}
                </p>
                <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                  <strong>Country:</strong> {avatarData.country || 'N/A'}
                </p>
                <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                  <strong>Registered:</strong>{' '}
                  {new Date(avatarData.registered * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={getOutfit}
              className="btn"
              style={{ marginTop: '1rem' }}
              disabled={isLoading}
            >
              View Full Outfit
            </button>
          </div>
        )}
      </div>

      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        fontSize: '0.875rem',
      }}>
        <strong>💡 Available Features:</strong>
        <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
          <li>Search products and view full details</li>
          <li>View detailed avatar information</li>
          <li>List complete outfit (all products)</li>
          <li>Check profile photos</li>
          <li>View friends and followers</li>
          <li>Access activity history</li>
        </ul>
      </div>
    </div>
  );
};
