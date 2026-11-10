( function () {
	'use strict';

	var fields = document.querySelectorAll( '.form-field input' );

	document.addEventListener( 'click', function ( event ) {
		var hash = String.fromCharCode( 35 );
		var popupPrefix = hash + 'popup-';
		var selector = 'a[href^="' + popupPrefix + '"]';
		var link = event.target.closest ? event.target.closest( selector ) : null;

		if ( ! link ) {
			return;
		}

		var href = link.getAttribute( 'href' ) || '';

		if ( href.indexOf( popupPrefix ) !== 0 ) {
			return;
		}

		var idPart = href.slice( popupPrefix.length );

		if ( ! /^\d+$/.test( idPart ) ) {
			return;
		}

		var popupId = Number( idPart );

		if ( ! Number.isFinite( popupId ) || popupId <= 0 || typeof window.LP_show !== 'function' ) {
			return;
		}

		event.preventDefault();
		window.LP_show( popupId );
	} );

	function updateFieldState( field ) {
		field.classList.toggle( 'has-value', field.value.trim() !== '' );
	}

	fields.forEach( function ( field ) {
		updateFieldState( field );
		field.addEventListener( 'input', function () {
			updateFieldState( field );
		} );
		field.addEventListener( 'change', function () {
			updateFieldState( field );
		} );
	} );

	document.querySelectorAll( '.service-equipment__flip-toggle' ).forEach( function ( toggle ) {
		toggle.addEventListener( 'click', function () {
			var card = toggle.closest( '.service-equipment__item' );

			if ( ! card ) {
				return;
			}

			var flipped = card.classList.toggle( 'is-flipped' );

			toggle.setAttribute( 'aria-pressed', String( flipped ) );
			toggle.setAttribute( 'aria-label', flipped ? toggle.dataset.hideLabel : toggle.dataset.showLabel );

			var description = card.querySelector( '.service-equipment__face--back' );

			if ( description ) {
				description.setAttribute( 'aria-hidden', String( ! flipped ) );
			}
		} );
	} );

	document.querySelectorAll( '.service-equipment__more' ).forEach( function ( button ) {
		var grid = button.previousElementSibling;

		if ( ! grid || ! grid.classList.contains( 'service-equipment__grid--collapsible' ) ) {
			return;
		}

		grid.classList.add( 'is-collapsed' );
		button.addEventListener( 'click', function () {
			var expanded = button.getAttribute( 'aria-expanded' ) !== 'true';

			grid.classList.toggle( 'is-collapsed', ! expanded );
			button.setAttribute( 'aria-expanded', String( expanded ) );
			button.textContent = expanded ? button.dataset.lessLabel : button.dataset.moreLabel;
		} );
	} );

    /* Mobile highlights: match carousel height to the visible card on smartphone-alarm pages. */
    if ( document.querySelector( '.service-application--smartphone-alarm' ) ) {
        document.querySelectorAll( '.service-hero__highlights' ).forEach( function ( list ) {
            var items = Array.prototype.slice.call( list.children );
            var timer;

            if ( ! items.length ) {
                return;
            }

            function updateHighlightsHeight() {
                if ( ! window.matchMedia( '(max-width: 767px)' ).matches ) {
                    list.style.removeProperty( 'height' );
                    return;
                }

                var listRect = list.getBoundingClientRect();
                var styles = window.getComputedStyle( list );
                var paddingLeft = parseFloat( styles.paddingLeft ) || 0;
                var paddingTop = parseFloat( styles.paddingTop ) || 0;
                var paddingBottom = parseFloat( styles.paddingBottom ) || 0;
                var targetLeft = listRect.left + paddingLeft;

                var active = items.reduce( function ( best, item ) {
                    var distance = Math.abs( item.getBoundingClientRect().left - targetLeft );
                    var bestDistance = Math.abs( best.getBoundingClientRect().left - targetLeft );

                    return distance < bestDistance ? item : best;
                } );

                var height = active.getBoundingClientRect().height + paddingTop + paddingBottom;

                list.style.setProperty( 'height', Math.ceil( height ) + 'px' );
            }

            list.addEventListener( 'scroll', function () {
                window.clearTimeout( timer );
                timer = window.setTimeout( updateHighlightsHeight, 80 );
            } );

            window.addEventListener( 'resize', updateHighlightsHeight );

            updateHighlightsHeight();
        } );
    }

    var mobileMenuToggle = document.querySelector( '.mobile-menu-toggle' );
    var mobileNavigation = document.querySelector( '#site-navigation' );

    if ( mobileMenuToggle && mobileNavigation ) {
        mobileMenuToggle.addEventListener( 'click', function () {
            var expanded = mobileMenuToggle.getAttribute( 'aria-expanded' ) === 'true';
            mobileMenuToggle.setAttribute( 'aria-expanded', String( ! expanded ) );
            mobileMenuToggle.setAttribute( 'aria-label', ! expanded ? 'Закрыть меню' : 'Открыть меню' );
            mobileNavigation.classList.toggle( 'is-mobile-open', ! expanded );
        } );
        document.addEventListener( 'keydown', function ( event ) {
            if ( event.key === 'Escape' && mobileNavigation.classList.contains( 'is-mobile-open' ) ) {
                mobileNavigation.classList.remove( 'is-mobile-open' );
                mobileMenuToggle.setAttribute( 'aria-expanded', 'false' );
                mobileMenuToggle.setAttribute( 'aria-label', 'Открыть меню' );
                mobileMenuToggle.focus();
            }
        } );
        mobileNavigation.addEventListener( 'click', function ( event ) {
            if ( event.target.closest( 'a' ) ) {
                mobileNavigation.classList.remove( 'is-mobile-open' );
                mobileMenuToggle.setAttribute( 'aria-expanded', 'false' );
                mobileMenuToggle.setAttribute( 'aria-label', 'Открыть меню' );
            }
        } );
    }

    if ( document.body.classList.contains( 'postid-17' ) || document.body.classList.contains( 'postid-16' ) ) {
        var standardsStack = document.querySelector( '.service-standards--split .service-standards__stack' );
        if ( document.body.classList.contains( 'postid-17' ) && standardsStack && standardsStack.children.length === 2 ) {
            var standardsOriginalOrder = Array.from( standardsStack.children );
            var standardsMobile = window.matchMedia( '(max-width: 767px)' );
            function orderStandards() {
                var ordered = standardsMobile.matches ? standardsOriginalOrder.slice().reverse() : standardsOriginalOrder;
                ordered.forEach( function ( card ) { standardsStack.appendChild( card ); } );
            }
            orderStandards();
            standardsMobile.addEventListener( 'change', orderStandards );
        }
        document.querySelectorAll( '.service-standards--split .service-standard' ).forEach( function ( card, index ) {
            card.setAttribute( 'role', 'button' );
            card.setAttribute( 'tabindex', '0' );
            card.setAttribute( 'aria-expanded', String( index === 0 ) );
            if ( index > 0 ) {
                card.classList.add( 'is-collapsed' );
            }
            function toggleCard() {
                if ( window.matchMedia( '(max-width: 767px)' ).matches ) {
                    card.classList.toggle( 'is-collapsed' );
                    card.setAttribute( 'aria-expanded', String( ! card.classList.contains( 'is-collapsed' ) ) );
                }
            }
            card.addEventListener( 'click', toggleCard );
            card.addEventListener( 'keydown', function ( event ) {
                if ( 'Enter' === event.key || ' ' === event.key ) {
                    event.preventDefault();
                    toggleCard();
                }
            } );
        } );
    }

    // Mobile tariff carousels use the shared snap-card and pagination pattern.
    if ( document.body.classList.contains( 'postid-17' ) || document.body.classList.contains( 'postid-16' ) || document.body.classList.contains( 'postid-18' ) || document.body.classList.contains( 'postid-19' ) ) {
        var tariffGrid = document.querySelector( '.service-pricing__grid' );
        var tariffPagination = document.querySelector( '.service-pricing__mobile-pagination' );
        if ( tariffGrid && tariffPagination ) {
            var tariffCards = Array.prototype.slice.call( tariffGrid.querySelectorAll( '.service-tariff' ) );
            var tariffDots = Array.prototype.slice.call( tariffPagination.querySelectorAll( '[data-tariff-index]' ) );
            var tariffMatch = window.matchMedia( '(max-width: 767px)' );
            var homeTariffCarousel = document.body.classList.contains( 'postid-19' );
            var tariffScrollQueued = false;

            function updateHomeTariffHeight( index ) {
                if ( ! homeTariffCarousel ) { return; }
                if ( ! tariffMatch.matches ) {
                    tariffGrid.style.removeProperty( 'height' );
                    return;
                }
                if ( tariffCards[index] ) {
                    tariffGrid.style.height = ( tariffCards[index].offsetHeight + 12 ) + 'px';
                }
            }

            function updateTariffDots() {
                if ( ! tariffMatch.matches ) { return; }
                var box = tariffGrid.getBoundingClientRect();
                var center = box.left + box.width / 2;
                var bestIndex = 0;
                var bestDistance = Infinity;
                tariffCards.forEach( function ( card, index ) {
                    var cardBox = card.getBoundingClientRect();
                    var distance = Math.abs( cardBox.left + cardBox.width / 2 - center );
                    if ( distance < bestDistance ) {
                        bestDistance = distance;
                        bestIndex = index;
                    }
                } );
                tariffDots.forEach( function ( dot, index ) {
                    dot.setAttribute( 'aria-pressed', String( index === bestIndex ) );
                } );
                updateHomeTariffHeight( bestIndex );
            }
            tariffDots.forEach( function ( dot, index ) {
                dot.addEventListener( 'click', function () {
                    if ( ! tariffMatch.matches || ! tariffCards[index] ) { return; }
                    var containerRect = tariffGrid.getBoundingClientRect();
                    var cardRect = tariffCards[index].getBoundingClientRect();
                    var offset = tariffGrid.scrollLeft + ( cardRect.left - containerRect.left ) - ( tariffGrid.clientWidth - cardRect.width ) / 2;
                    updateHomeTariffHeight( index );
                    tariffGrid.scrollTo( { left: offset, behavior: window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'instant' : 'smooth' } );
                } );
            } );
            tariffGrid.addEventListener( 'scroll', function () {
                if ( tariffScrollQueued ) { return; }
                tariffScrollQueued = true;
                window.requestAnimationFrame( function () {
                    tariffScrollQueued = false;
                    updateTariffDots();
                } );
            }, { passive: true } );
            window.addEventListener( 'resize', updateTariffDots );
            updateTariffDots();
        }
    }

}() );

/* BAGIRA-TRANSPORT-TABLET-STANDARDS-ACCORDION-V4:START */

(function () {
  'use strict';
  function initialize() {
    if (!document.body.classList.contains('postid-15')) return;
    var root = document.querySelector('.service-standards--mosaic');
    if (!root || root.dataset.bagiraTransportTabletAccordion === 'ready') return;
    var cards = Array.from(root.querySelectorAll('.service-standard'));
    if (cards.length < 2) return;
    root.dataset.bagiraTransportTabletAccordion = 'ready';
    var query = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    var activeIndex = 2; // Expanded in the reference Figma screenshot
    var buttons = [];
    cards.forEach(function (card, index) {
      var copy = card.querySelector('.service-standard__copy');
      var title = card.querySelector('h3');
      if (!copy || !title) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'bagira-transport-tablet-toggle';
      button.setAttribute('aria-label', 'Развернуть: ' + title.textContent.trim());
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('title', 'Развернуть или свернуть карточку');
      copy.appendChild(button);
      buttons[index] = button;
      button.addEventListener('click', function () {
        if (!query.matches) return;
        activeIndex = activeIndex === index ? -1 : index;
        update();
      });
    });
    function update() {
      cards.forEach(function (card, index) {
        var button = buttons[index];
        if (!button) return;
        var enabled = query.matches;
        var expanded = enabled && index === activeIndex;
        card.classList.toggle('bagira-tablet-expanded', expanded);
        card.classList.toggle('bagira-tablet-collapsed', enabled && !expanded);
        button.hidden = !enabled;
        button.textContent = expanded ? '\u2212' : '+';
        button.setAttribute('aria-expanded', String(expanded));
        var title = card.querySelector('h3');
        button.setAttribute('aria-label', (expanded ? 'Свернуть: ' : 'Развернуть: ') + (title ? title.textContent.trim() : 'карточку'));
      });
    }
    query.addEventListener('change', update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
}());

/* BAGIRA-TRANSPORT-TABLET-STANDARDS-ACCORDION-V4:END */

// BAGIRA-TRANSPORT-MOBILE-STANDARDS-V5:START
(function () {
  'use strict';
  function setupTransportMobileStandards() {
    if (!document.body.classList.contains('postid-15')) return;
    var root = document.querySelector('.service-standards--mosaic');
    if (!root || root.dataset.bagiraMobileAccordionV5 === 'ready') return;
    var cards = Array.prototype.slice.call(root.querySelectorAll('article.service-standard'));
    if (cards.length !== 4) return;
    root.dataset.bagiraMobileAccordionV5 = 'ready';
    var media = window.matchMedia('(max-width: 767px)');
    var active = 2; // The third card is open in the mobile Figma reference.
    var controls = [];

    cards.forEach(function (card, index) {
      var title = card.querySelector('h3');
      if (!title) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'bagira-transport-mobile-toggle';
      button.setAttribute('aria-label', 'Развернуть: ' + title.textContent.trim());
      button.setAttribute('aria-expanded', 'false');
      card.appendChild(button); // Does not replace or modify existing content.
      controls[index] = button;
      button.addEventListener('click', function () {
        if (!media.matches) return;
        active = active === index ? -1 : index;
        update();
      });
    });

    function update() {
      var mobile = media.matches;
      root.classList.toggle('bagira-mobile-accordion-ready', mobile);
      cards.forEach(function (card, index) {
        var expanded = mobile && index === active;
        card.classList.toggle('bagira-mobile-open', expanded);
        card.classList.toggle('bagira-mobile-closed', mobile && !expanded);
        var title = card.querySelector('h3');
        var control = controls[index];
        if (control) {
          control.hidden = !mobile;
          control.setAttribute('aria-expanded', String(expanded));
          control.setAttribute('aria-label', (expanded ? 'Свернуть: ' : 'Развернуть: ') + (title ? title.textContent.trim() : 'карточку'));
        }
        // Visually hidden content is also hidden from screen readers in collapsed mode.
        var text = card.querySelector('.service-standard__text');
        var image = card.querySelector('.service-standard__image');
        if (text) {
          if (mobile && !expanded) text.setAttribute('aria-hidden', 'true');
          else text.removeAttribute('aria-hidden');
        }
        if (image) {
          // The original image wrapper is decorative on this page.
          if (mobile && !expanded) image.setAttribute('aria-hidden', 'true');
          else if (!image.hasAttribute('aria-hidden')) image.setAttribute('aria-hidden', 'true');
        }
      });
    }
    if (typeof media.addEventListener === 'function') media.addEventListener('change', update);
    else if (typeof media.addListener === 'function') media.addListener(update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupTransportMobileStandards);
  else setupTransportMobileStandards();
})();
// BAGIRA-TRANSPORT-MOBILE-STANDARDS-V5:END
