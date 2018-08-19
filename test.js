import React from 'react';

const Lad = ({ height, mb }) => (
  <div 
    mb={[1, 2, mb, mb ? 1 : 2]}
    ml="5"
    mr={mb}
    mt={4}
    pt={[1,3]}
    pb={[2, height]}
  />
)